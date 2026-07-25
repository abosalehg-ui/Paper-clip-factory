import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import {
    effectiveDemandCap, demandFloor, demandRestoreStep, maxPrice,
    computeWireCost, prestigeMultiplier, autoSellSlots,
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

export function makeClip(buttonEl) {
    if (gameState.wire < 1 || gameState.clips >= gameState.maxClipsLimit) return false;

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

export function resetSellCooldown() {
    lastManualSellTime = 0;
}

function performSale() {
    const sellAmount = Math.min(gameState.clips, gameState.demand);
    if (sellAmount <= 0) return 0;

    gameState.clips -= sellAmount;
    gameState.money += sellAmount * gameState.price;
    gameState.totalSold += sellAmount;
    gameState.lifetimeSold += sellAmount;
    gameState.demand = Math.max(
        demandFloor(gameState.marketingLevel, gameState.price),
        gameState.demand - Math.floor(sellAmount * GAME_CONFIG.DEMAND_DECAY_FRACTION),
    );
    return sellAmount;
}

export function canSellNow() {
    return Date.now() - lastManualSellTime >= GAME_CONFIG.MANUAL_SELL_COOLDOWN_MS;
}

export function sellClips(buttonEl) {
    if (gameState.clips <= 0) return false;
    // The cooldown is what stops key-repeat from beating the automation.
    if (!canSellNow()) return false;
    lastManualSellTime = Date.now();

    const sellAmount = performSale();
    if (sellAmount > 0) {
        if (buttonEl) createFloatingEmoji(buttonEl, '💵', Math.min(sellAmount, 8));
        playSound('cash');
        checkTrophy(gameState.totalSold);
        checkLocalRecord();
    }

    flash('card-money');
    flash('card-clips');
    return sellAmount > 0;
}

export function autoSellTick() {
    if (!gameState.autoSellEnabled || gameState.clips <= 0) return false;

    // Emulate the manual cadence for this window at a slight discount, so
    // idling stays worth roughly AUTO_SELL_EFFICIENCY of active play.
    let sold = 0;
    const slots = autoSellSlots();
    for (let i = 0; i < slots; i++) {
        const amount = performSale();
        if (amount <= 0) break;
        sold += amount;
    }
    if (sold <= 0) return false;

    playSound('cash');
    checkTrophy(gameState.totalSold);
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
