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
// price that maximises it is exactly half the choke price. This is the right
// answer ONLY when demand is the binding constraint. Kept because it is the
// correct floor for the real answer below, and because a player with no
// machines has no supply rate to reason about yet.
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

// Demand recovers by a fraction of the cap per second rather than by a flat
// "+marketingLevel", which was invisible once the cap grew.
export function demandRestoreStep(marketingLevel, price) {
    const cap = effectiveDemandCap(marketingLevel, price);
    const perTick = GAME_CONFIG.DEMAND_RESTORE_FRACTION_PER_SECOND
        * GAME_CONFIG.PRODUCTION_TICK_MS / 1000;
    return Math.max(1, Math.ceil(cap * perTick));
}

// Clips per second the market absorbs in the long run at this price. Demand is
// a stock consumed 1:1 by sales and refilled by restoreDemand(), so in steady
// state the sales rate cannot exceed the refill rate — whatever the cadence.
export function demandThroughputPerSecond(marketingLevel, price) {
    return effectiveDemandCap(marketingLevel, price)
        * GAME_CONFIG.DEMAND_RESTORE_FRACTION_PER_SECOND;
}

// The price the player should actually charge.
//
// A sale moves min(clips, demand), so income per second is
//     price x min(supplyPerSecond, demandThroughputPerSecond(price))
// not price x demand. Measured over three simulated hours, supply is the
// binding side on 99.7% of sale ticks — and a supply-limited factory should
// RAISE its price, because every clip it makes sells anyway. Following the old
// choke/2 hint cost roughly half the income of pricing near the supply point.
//
// Below the supply point income is price x supply, which rises with price, so
// the optimum sits exactly where market absorption drops to meet production.
// Past that point demand binds and the choke/2 parabola takes over, so the
// answer is the larger of the two.
export function optimalPriceForSupply(marketingLevel, supplyPerSecond) {
    const revenueMax = optimalPrice(marketingLevel);
    if (!Number.isFinite(supplyPerSecond) || supplyPerSecond <= 0) return revenueMax;

    // Absorption at price 0 — the most the market can ever take.
    const maxAbsorption = demandThroughputPerSecond(marketingLevel, 0);
    if (supplyPerSecond >= maxAbsorption) return revenueMax;

    // Invert the linear demand curve: find the price whose absorption equals
    // production, so nothing is made that cannot be sold and nothing is sold
    // cheaper than it needs to be.
    const choke = chokePrice(marketingLevel);
    const supplyPrice = choke * (1 - supplyPerSecond / maxAbsorption);
    return Math.min(
        maxPrice(marketingLevel),
        Math.max(GAME_CONFIG.MIN_PRICE, Math.max(revenueMax, supplyPrice)),
    );
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

// Permanent, prestige-only production multiplier. Compounds per point so it
// keeps pace with exponential upgrade costs instead of fading against them;
// capped so a hand-edited point count cannot reach Infinity and poison every
// downstream number.
export function prestigeMultiplier(prestigePoints) {
    const points = Math.max(0, prestigePoints);
    const multiplier = Math.pow(1 + GAME_CONFIG.PRESTIGE_BONUS_PER_POINT, points);
    if (!Number.isFinite(multiplier)) return GAME_CONFIG.PRESTIGE_MULTIPLIER_CAP;
    return Math.min(GAME_CONFIG.PRESTIGE_MULTIPLIER_CAP, multiplier);
}

// Points a reset would award right now. Lifetime sales are what count, so
// prestiging does not throw away the progress that earned it.
export function pendingPrestigePoints(lifetimeSold, prestigePointsEarned) {
    const total = Math.floor(Math.max(0, lifetimeSold) / GAME_CONFIG.PRESTIGE_REQUIREMENT);
    return Math.max(0, total - Math.max(0, prestigePointsEarned));
}

// What one auto-sold clip fetches, as a fraction of the list price. See the
// AUTO_SELL_EFFICIENCY comment in config.js for why the discount lives on the
// price rather than on the sale cadence.
export function autoSellPriceFactor() {
    return Math.min(1, Math.max(0, GAME_CONFIG.AUTO_SELL_EFFICIENCY));
}

// Sustained clips/second a given number of machines produces, prestige
// included. Used by the pricing hint, which needs a rate rather than a
// per-tick count.
export function productionPerSecond(autoClippers, prestigePoints) {
    const perTick = Math.floor(Math.max(0, autoClippers) * prestigeMultiplier(prestigePoints));
    return perTick * 1000 / GAME_CONFIG.PRODUCTION_TICK_MS;
}
