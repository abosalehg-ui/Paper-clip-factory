// Pure economic maths. No imports beyond config, no state, no DOM — so both
// the live game and the save-validation layer can share it without a cycle,
// and every curve here is directly unit-testable.

import { GAME_CONFIG } from './config.js';

// The price at which demand reaches zero. Marketing is what buys the right to
// charge more, so it moves the whole curve outward.
export function chokePrice(marketingLevel) {
    const level = Math.max(1, marketingLevel);
    return GAME_CONFIG.PRICE_CHOKE_BASE * (1 + (level - 1) * GAME_CONFIG.PRICE_CHOKE_GROWTH);
}

// Hard ceiling on what the player may set. Above the choke price nobody buys,
// so allowing more would only be a way to fake a big number on screen.
export function maxPrice(marketingLevel) {
    return Math.max(GAME_CONFIG.MIN_PRICE, chokePrice(marketingLevel));
}

// Revenue = price x demand is a parabola under a linear demand curve, so the
// revenue-maximising price is exactly half the choke price. Surfaced to the
// player as a hint rather than applied automatically — finding it is the game.
export function optimalPrice(marketingLevel) {
    return Math.max(GAME_CONFIG.MIN_PRICE, chokePrice(marketingLevel) / 2);
}

export function baseDemandCap(marketingLevel) {
    return GAME_CONFIG.DEMAND_CAP_PER_LEVEL * Math.max(1, marketingLevel);
}

// Linear demand curve: full base demand as price -> 0, zero at the choke
// price. This is the single change that turns pricing from a free-money
// button into a real trade-off between margin and volume.
export function effectiveDemandCap(marketingLevel, price) {
    const choke = chokePrice(marketingLevel);
    const ratio = Math.max(0, 1 - Math.max(0, price) / choke);
    return Math.max(1, Math.floor(baseDemandCap(marketingLevel) * ratio));
}

// Selling pushes demand down but never below a fraction of the current cap,
// so the floor stays meaningful at every scale.
export function demandFloor(marketingLevel, price) {
    return Math.max(1, Math.floor(effectiveDemandCap(marketingLevel, price) * GAME_CONFIG.DEMAND_FLOOR_FRACTION));
}

// Demand recovers by a fraction of the cap per restore tick rather than by a
// flat "+marketingLevel", which was invisible once the cap grew.
export function demandRestoreStep(marketingLevel, price) {
    const cap = effectiveDemandCap(marketingLevel, price);
    return Math.max(1, Math.ceil(cap * GAME_CONFIG.DEMAND_RESTORE_FRACTION));
}

// Wire drifts up with lifetime production. Capped so a very long game cannot
// price wire out of reach entirely.
export function computeWireCost(totalClips) {
    const growth = 1 + Math.max(0, totalClips) / GAME_CONFIG.WIRE_COST_SCALE;
    const capped = Math.min(growth, GAME_CONFIG.MAX_WIRE_COST_MULTIPLIER);
    return Math.max(1, Math.floor(GAME_CONFIG.INITIAL_WIRE_COST * capped));
}

// Machine price is a pure function of how many you own, so it de-escalates
// when machines are destroyed and stays consistent across saves.
export function computeAutoClipperCost(count) {
    return Math.floor(
        GAME_CONFIG.INITIAL_AUTO_CLIPPER_COST *
        Math.pow(GAME_CONFIG.AUTO_CLIPPER_COST_MULTIPLIER, Math.max(0, count)),
    );
}

export function computeMarketingCost(marketingLevel) {
    return Math.floor(
        GAME_CONFIG.MARKETING_BASE_COST *
        Math.pow(GAME_CONFIG.MARKETING_COST_MULTIPLIER, Math.max(1, marketingLevel) - 1),
    );
}

// Permanent, prestige-only production multiplier.
export function prestigeMultiplier(prestigePoints) {
    return 1 + Math.max(0, prestigePoints) * GAME_CONFIG.PRESTIGE_BONUS_PER_POINT;
}

// Points a reset would award right now. Lifetime sales are what count, so
// prestiging does not throw away the progress that earned it.
export function pendingPrestigePoints(lifetimeSold, prestigePointsEarned) {
    const total = Math.floor(Math.max(0, lifetimeSold) / GAME_CONFIG.PRESTIGE_REQUIREMENT);
    return Math.max(0, total - Math.max(0, prestigePointsEarned));
}

// How many sales the auto-seller performs per tick: the manual cadence for
// the same window, discounted by AUTO_SELL_EFFICIENCY. Deriving it this way
// keeps "idle is ~85% of active" true by construction, whatever else is tuned.
export function autoSellSlots() {
    const manualSlots = GAME_CONFIG.SELL_TICK_MS / GAME_CONFIG.MANUAL_SELL_COOLDOWN_MS;
    return Math.max(1, Math.floor(manualSlots * GAME_CONFIG.AUTO_SELL_EFFICIENCY));
}
