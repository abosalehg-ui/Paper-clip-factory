import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import {
    effectiveDemandCap, demandFloor, demandRestoreStep, maxPrice,
    computeWireCost, prestigeMultiplier, autoSellPriceFactor,
} from './economy.js';
import { playSound } from './audio.js';
import { createFloatingEmoji, flash } from './effects.js';
import { checkTrophy, checkLocalRecord } from './achievements.js';

// Wire price drifts with lifetime production, so it is refreshed wherever
// production happens rather than stored and trusted.
function refreshWireCost() {
    gameState.wireCost = computeWireCost(gameState.totalClips);
}

// Clamp demand into the band the current price supports. Called after
// anything that moves price or marketing level.
function clampDemand() {
    const cap = effectiveDemandCap(gameState.marketingLevel, gameState.price);
    gameState.demand = Math.max(1, Math.min(cap, gameState.demand));
}

// ---- Manual production rate limit ---------------------------------------
// A token bucket rather than a flat cooldown, so short bursts of tapping feel
// unrestricted while sustained key auto-repeat cannot outrun the factory.

let makeTokens = 0;
let lastMakeRefill = 0;

// Sustained manual clips/second. The wire-efficiency upgrade raises it, which
// gives that upgrade a second job and turns "hold the key down" from an
// exploit into something the player buys.
export function manualMakeRate() {
    const bonus = Math.max(0, gameState.wireEfficiency - 1)
        * GAME_CONFIG.MANUAL_MAKE_RATE_PER_EFFICIENCY;
    return GAME_CONFIG.MANUAL_MAKE_BASE_RATE + bonus;
}

function refillMakeTokens(now) {
    const rate = manualMakeRate();
    const depth = rate * GAME_CONFIG.MANUAL_MAKE_BURST_SECONDS;
    if (!lastMakeRefill) {
        // First press of the session (or after a reset): start with a full
        // bucket so the very first tap is never swallowed.
        makeTokens = depth;
    } else {
        makeTokens = Math.min(depth, makeTokens + (now - lastMakeRefill) / 1000 * rate);
    }
    lastMakeRefill = now;
}

export function canMakeNow(now = Date.now()) {
    refillMakeTokens(now);
    return makeTokens >= 1;
}

// `now` is injectable so the rate limit can be exercised over simulated time
// instead of wall-clock time, the same way events.js takes an rng.
export function makeClip(buttonEl, now = Date.now()) {
    if (gameState.wire < 1 || gameState.clips >= gameState.maxClipsLimit) return false;
    if (!canMakeNow(now)) return false;
    makeTokens -= 1;

    gameState.clips++;
    gameState.totalClips++;
    gameState.wire--;
    refreshWireCost();

    if (buttonEl) createFloatingEmoji(buttonEl, '📎', 1);
    playSound('click');
    flash('card-clips');
    flash('card-wire');
    return true;
}

// ---- Selling ------------------------------------------------------------
// One shared sale core drives both the manual button and the auto-seller, so
// the two can never drift apart in balance. The manual path adds a cooldown
// and the juice; the auto path just runs the core on a cadence.

let lastManualSellTime = 0;

// Clears every input rate limiter. Called by "new game", prestige, the
// game-over restart and a save import, so a fresh run never starts throttled
// by the previous one.
export function resetInputCooldowns() {
    lastManualSellTime = 0;
    makeTokens = 0;
    lastMakeRefill = 0;
}

// `priceFactor` is the share of the list price this channel fetches: 1 for a
// manual sale, AUTO_SELL_EFFICIENCY for the auto-seller.
function performSale(priceFactor = 1) {
    const sellAmount = Math.min(gameState.clips, gameState.demand);
    if (sellAmount <= 0) return 0;

    gameState.clips -= sellAmount;
    gameState.money += sellAmount * gameState.price * priceFactor;
    gameState.totalSold += sellAmount;
    gameState.lifetimeSold += sellAmount;
    gameState.demand = Math.max(
        demandFloor(gameState.marketingLevel, gameState.price),
        gameState.demand - Math.floor(sellAmount * GAME_CONFIG.DEMAND_DECAY_FRACTION),
    );
    return sellAmount;
}

export function canSellNow(now = Date.now()) {
    return now - lastManualSellTime >= GAME_CONFIG.MANUAL_SELL_COOLDOWN_MS;
}

export function sellClips(buttonEl, now = Date.now()) {
    if (gameState.clips <= 0) return false;
    // The cooldown is what stops key-repeat from beating the automation.
    if (!canSellNow(now)) return false;
    lastManualSellTime = now;

    const sellAmount = performSale();
    if (sellAmount > 0) {
        if (buttonEl) createFloatingEmoji(buttonEl, '💵', Math.min(sellAmount, 8));
        playSound('cash');
        checkTrophy(gameState.lifetimeSold);
        checkLocalRecord();
    }

    flash('card-money');
    flash('card-clips');
    return sellAmount > 0;
}

export function autoSellTick() {
    if (!gameState.autoSellEnabled || gameState.clips <= 0) return false;

    // One sale clears min(clips, demand) outright, so repeating it within the
    // same tick can only ever return 0 — the old slot loop was inert. The
    // "idling is worth ~85% of clicking" trade-off is carried by the price
    // instead, where it survives the fact that throughput is set by demand
    // regeneration rather than by how often anyone presses the button.
    const sold = performSale(autoSellPriceFactor());
    if (sold <= 0) return false;

    playSound('cash');
    checkTrophy(gameState.lifetimeSold);
    checkLocalRecord();
    flash('card-money');
    flash('card-clips');
    return true;
}

export function buyWire() {
    refreshWireCost();
    if (gameState.money < gameState.wireCost) return false;
    gameState.money -= gameState.wireCost;
    gameState.wire += GAME_CONFIG.WIRE_PURCHASE_AMOUNT * gameState.wireEfficiency;
    playSound('buy');
    flash('card-wire');
    flash('card-money');
    return true;
}

// ---- Pricing ------------------------------------------------------------
// Price is bounded by the choke price: past it the demand curve reads zero,
// so allowing more would only fake a big number on screen.

export function adjustPrice(delta) {
    gameState.priceExplored = true;
    const ceiling = maxPrice(gameState.marketingLevel);
    const next = Math.round((gameState.price + delta) * 100) / 100;
    gameState.price = Math.min(ceiling, Math.max(GAME_CONFIG.MIN_PRICE, next));

    // A nudge in demand on top of the curve, so the buttons feel responsive
    // before the next restore tick lands.
    const cap = effectiveDemandCap(gameState.marketingLevel, gameState.price);
    if (delta > 0) {
        gameState.demand = Math.max(1, gameState.demand - GAME_CONFIG.PRICE_DEMAND_STEP);
    } else {
        gameState.demand = gameState.demand + GAME_CONFIG.PRICE_DEMAND_STEP;
    }
    gameState.demand = Math.max(1, Math.min(cap, gameState.demand));
    flash('card-demand');
    return gameState.price;
}

export function setPrice(newPrice) {
    if (!Number.isFinite(newPrice) || newPrice <= 0) return false;
    gameState.priceExplored = true;
    const ceiling = maxPrice(gameState.marketingLevel);
    gameState.price = Math.min(
        ceiling,
        Math.max(GAME_CONFIG.MIN_PRICE, Math.round(newPrice * 100) / 100),
    );
    clampDemand();
    flash('card-demand');
    return true;
}

export function toggleAutoSell() {
    gameState.autoSellEnabled = !gameState.autoSellEnabled;
    return gameState.autoSellEnabled;
}

// ---- Production ---------------------------------------------------------

// Clips a full production tick would make, before warehouse/wire limits.
export function productionPerTick() {
    return Math.floor(gameState.autoClippers * prestigeMultiplier(gameState.prestigePoints));
}

export function autoProduceTick() {
    // Partial production: with less wire than machines, the remaining wire is
    // still consumed (one clip per wire) instead of stalling the whole floor.
    // autoClipperRate always reflects what was actually produced this tick.
    if (gameState.autoClippers <= 0) {
        gameState.autoClipperRate = 0;
        return false;
    }
    const availableSpace = gameState.maxClipsLimit - gameState.clips;
    const clipsMade = Math.max(0, Math.min(productionPerTick(), gameState.wire, availableSpace));
    gameState.autoClipperRate = clipsMade;
    if (clipsMade <= 0) return false;

    gameState.clips += clipsMade;
    gameState.totalClips += clipsMade;
    gameState.wire -= clipsMade;
    refreshWireCost();
    flash('card-clips');
    flash('card-wire');
    return true;
}

// One second of world time: the factory produces, and the market recovers a
// little of the demand that has been sold off. Keeping them on the same tick
// is what makes the demand readout move smoothly instead of in lumps.
export function productionTick() {
    const produced = autoProduceTick();
    restoreDemand();
    return produced;
}

export function restoreDemand() {
    const cap = effectiveDemandCap(gameState.marketingLevel, gameState.price);
    const step = demandRestoreStep(gameState.marketingLevel, gameState.price);
    gameState.demand = Math.max(1, Math.min(cap, gameState.demand + step));
}

export function isGameOver() {
    refreshWireCost();
    return (
        gameState.wire < 1 &&
        gameState.money < gameState.wireCost &&
        gameState.clips < 1
    );
}
