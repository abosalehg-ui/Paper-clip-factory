import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import {
    chokePrice, maxPrice, optimalPrice, baseDemandCap, effectiveDemandCap,
    demandFloor, demandRestoreStep, computeWireCost, computeAutoClipperCost,
    computeMarketingCost, prestigeMultiplier, pendingPrestigePoints,
    autoSellPriceFactor, demandThroughputPerSecond, optimalPriceForSupply,
    productionPerSecond,
} from '../js/economy.js';

// ---- The demand curve ----------------------------------------------------
// This is the regression suite for the bug that broke the whole economy:
// price had no upper bound and demand did not depend on it, so typing a large
// number into the price field was free money.

test('demand falls as price rises and reaches its floor at the choke price', () => {
    const level = 1;
    const choke = chokePrice(level);
    const atZero = effectiveDemandCap(level, 0);
    const atHalf = effectiveDemandCap(level, choke / 2);
    const atChoke = effectiveDemandCap(level, choke);

    assert.equal(atZero, baseDemandCap(level));
    assert.ok(atHalf < atZero, 'demand must drop as price rises');
    assert.ok(atChoke < atHalf);
    assert.equal(atChoke, 1, 'nobody buys at the choke price');
});

test('demand never goes below 1 even far past the choke price', () => {
    assert.equal(effectiveDemandCap(1, chokePrice(1) * 1000), 1);
});

test('revenue peaks at the optimal price — neither extreme wins', () => {
    const level = 3;
    const best = optimalPrice(level);
    const revenue = (p) => p * effectiveDemandCap(level, p);

    const peak = revenue(best);
    // Sample the whole curve; no sampled price may beat the stated optimum.
    for (let p = 0.01; p <= chokePrice(level) + 0.5; p += 0.01) {
        assert.ok(
            revenue(p) <= peak + 1e-6,
            `price ${p.toFixed(2)} earns ${revenue(p)} which beats the optimum ${peak}`,
        );
    }
    // And the optimum genuinely beats both ends of the range.
    assert.ok(peak > revenue(GAME_CONFIG.MIN_PRICE));
    assert.ok(peak > revenue(chokePrice(level)));
});

test('the price ceiling is the choke price and grows with marketing', () => {
    assert.equal(maxPrice(1), chokePrice(1));
    assert.ok(maxPrice(10) > maxPrice(1), 'marketing buys the right to charge more');
    assert.ok(maxPrice(50) > maxPrice(10));
});

test('marketing widens both the volume and the price ceiling', () => {
    const price = 0.25;
    assert.ok(effectiveDemandCap(5, price) > effectiveDemandCap(1, price));
    assert.ok(baseDemandCap(5) > baseDemandCap(1));
});

test('demand is a stock: no guaranteed drip, and it refills relative to the cap', () => {
    // The floor used to guarantee 10% of the cap on every single sale, which
    // dominated the decay entirely — demand sat at its ceiling 66% of the time
    // and bound a sale in 0.3% of ticks. Selling now consumes demand and only
    // regeneration brings it back, which is what makes dumping a full
    // warehouse a decision instead of a free action.
    assert.ok(demandFloor(1, 0.25) >= 1, 'never zero, so the game cannot deadlock');
    assert.ok(demandFloor(50, 0.25) < effectiveDemandCap(50, 0.25) * 0.05,
        'no meaningful free demand at any scale');
    assert.ok(demandRestoreStep(50, 0.25) > demandRestoreStep(1, 0.25));
    assert.ok(demandRestoreStep(1, 0.25) >= 1);
});

// ---- Cost curves ---------------------------------------------------------

test('wire price rises with lifetime production and is capped', () => {
    assert.equal(computeWireCost(0), GAME_CONFIG.INITIAL_WIRE_COST);
    assert.equal(
        computeWireCost(GAME_CONFIG.WIRE_COST_SCALE),
        GAME_CONFIG.INITIAL_WIRE_COST * 2,
    );
    assert.ok(computeWireCost(1e12) <= GAME_CONFIG.INITIAL_WIRE_COST * GAME_CONFIG.MAX_WIRE_COST_MULTIPLIER);
});

test('marketing cost is exponential, not linear', () => {
    const l1 = computeMarketingCost(1);
    const l2 = computeMarketingCost(2);
    const l10 = computeMarketingCost(10);
    assert.equal(l1, GAME_CONFIG.MARKETING_BASE_COST);
    assert.ok(l2 > l1);
    // Linear pricing (100 x level) would put level 10 at 1000; exponential
    // pricing is what stops marketing from swallowing the economy.
    assert.ok(l10 > GAME_CONFIG.MARKETING_BASE_COST * 10);
});

test('machine cost is a pure function of the owned count', () => {
    assert.equal(computeAutoClipperCost(0), GAME_CONFIG.INITIAL_AUTO_CLIPPER_COST);
    assert.ok(computeAutoClipperCost(10) > computeAutoClipperCost(9));
    assert.equal(computeAutoClipperCost(-5), GAME_CONFIG.INITIAL_AUTO_CLIPPER_COST);
});

test('marketing can no longer be levelled to absurdity on pocket change', () => {
    // Under the old linear curve a broken economy reached marketing level
    // 66,000 — one upgrade had eaten the entire game. Exponential pricing puts
    // a hard practical ceiling on how far a given bankroll can push it.
    const budget = 1e9;
    let level = 1;
    let spent = 0;
    while (spent + computeMarketingCost(level) <= budget) {
        spent += computeMarketingCost(level);
        level++;
    }
    assert.ok(level < 100, `a $1e9 budget reached marketing level ${level}`);

    // The same budget under the old linear curve would have reached a level
    // several orders of magnitude higher.
    const linearLevel = Math.sqrt((2 * budget) / GAME_CONFIG.MARKETING_BASE_COST);
    assert.ok(linearLevel > level * 100);
});

test('automating production is the cheaper first move', () => {
    // Machines buy throughput directly and cheaply at the start, so the
    // opening of the game still points at the factory rather than at an
    // upgrade that trivialises it.
    const perClipPerSecond = {
        machine: computeAutoClipperCost(5),
        marketing: computeMarketingCost(5) / 5,
    };
    assert.ok(perClipPerSecond.machine < perClipPerSecond.marketing);
});

// ---- Prestige ------------------------------------------------------------

test('prestige multiplier grows with banked points', () => {
    const step = 1 + GAME_CONFIG.PRESTIGE_BONUS_PER_POINT;
    assert.equal(prestigeMultiplier(0), 1);
    assert.equal(prestigeMultiplier(2), step ** 2);
    assert.equal(prestigeMultiplier(-3), 1);
});

test('the prestige bonus compounds instead of fading against exponential costs', () => {
    // The additive version handed out a smaller and smaller *relative* gain as
    // points accumulated, which is why resetting stopped paying after ~10 runs.
    const gainAt = (n) => prestigeMultiplier(n + 1) / prestigeMultiplier(n);
    assert.ok(Math.abs(gainAt(0) - gainAt(40)) < 1e-9,
        'the twenty-first point must be worth as much, proportionally, as the first');
    assert.ok(prestigeMultiplier(50) > prestigeMultiplier(25));
});

test('the prestige multiplier stays finite for an absurd point count', () => {
    // Save rules allow prestigePoints up to 1e6; 1.04 ** 1e6 overflows to
    // Infinity, which would poison every number downstream of production.
    const huge = prestigeMultiplier(1e6);
    assert.ok(Number.isFinite(huge));
    assert.equal(huge, GAME_CONFIG.PRESTIGE_MULTIPLIER_CAP);
});

test('prestige points come from lifetime sales and cannot be claimed twice', () => {
    const req = GAME_CONFIG.PRESTIGE_REQUIREMENT;
    assert.equal(pendingPrestigePoints(req - 1, 0), 0);
    assert.equal(pendingPrestigePoints(req, 0), 1);
    assert.equal(pendingPrestigePoints(req * 3, 0), 3);
    assert.equal(pendingPrestigePoints(req * 3, 3), 0, 'already-banked points are not re-awarded');
    assert.equal(pendingPrestigePoints(req * 4, 3), 1);
});

// ---- Automation ----------------------------------------------------------

test('auto-sold clips fetch exactly the configured share of the list price', () => {
    // The discount is a price, not a cadence: a sale clears min(clips, demand)
    // outright, so no arrangement of sale timings could ever have expressed
    // "idling is 85% of clicking".
    assert.equal(autoSellPriceFactor(), GAME_CONFIG.AUTO_SELL_EFFICIENCY);
    assert.ok(autoSellPriceFactor() < 1, 'idling must not beat clicking');
    assert.ok(autoSellPriceFactor() > 0);
});

// ---- Supply-aware pricing ------------------------------------------------
// The old hint maximised price x demand, which is the right answer only when
// demand is the binding constraint. Over three simulated hours, supply bound
// 99.7% of sale ticks — and following the hint cost roughly half the income of
// pricing near the point where absorption meets production.

test('market absorption is the demand regeneration rate and falls as price rises', () => {
    const level = 4;
    const cheap = demandThroughputPerSecond(level, 0.1);
    const dear = demandThroughputPerSecond(level, chokePrice(level) * 0.9);
    assert.ok(cheap > dear);
    assert.ok(dear >= 0);

    assert.equal(
        demandThroughputPerSecond(level, 0),
        baseDemandCap(level) * GAME_CONFIG.DEMAND_RESTORE_FRACTION_PER_SECOND,
    );
});

test('a supply-limited factory is told to charge more than half the choke price', () => {
    const level = 10;
    const choke = chokePrice(level);
    const absorptionAtZero = demandThroughputPerSecond(level, 0);
    // Production well below what the market could take: the classic case.
    const hint = optimalPriceForSupply(level, absorptionAtZero * 0.2);
    assert.ok(hint > optimalPrice(level),
        'every clip sells anyway, so the price should rise to meet production');
    assert.ok(hint < choke, 'never at or past the choke price — nobody buys there');
});

test('the hinted price is where market absorption meets production', () => {
    const level = 7;
    const supply = demandThroughputPerSecond(level, 0) * 0.35;
    const hint = optimalPriceForSupply(level, supply);
    assert.ok(Math.abs(demandThroughputPerSecond(level, hint) - supply) < 1e-6);
});

test('the hint falls back to the revenue-maximising price when demand binds', () => {
    const level = 6;
    const flooded = demandThroughputPerSecond(level, 0) * 5;
    assert.equal(optimalPriceForSupply(level, flooded), optimalPrice(level));
    // No machines yet: there is no supply rate to reason about.
    assert.equal(optimalPriceForSupply(level, 0), optimalPrice(level));
    assert.equal(optimalPriceForSupply(level, NaN), optimalPrice(level));
});

test('the hint always stays inside the price bounds the game accepts', () => {
    for (let level = 1; level <= 60; level += 7) {
        for (const share of [0, 0.01, 0.2, 0.5, 0.9, 1, 3]) {
            const supply = demandThroughputPerSecond(level, 0) * share;
            const hint = optimalPriceForSupply(level, supply);
            assert.ok(hint >= GAME_CONFIG.MIN_PRICE, `level ${level} share ${share}`);
            assert.ok(hint <= maxPrice(level), `level ${level} share ${share}`);
        }
    }
});

test('production per second scales with machines and prestige', () => {
    assert.equal(productionPerSecond(0, 0), 0);
    assert.equal(productionPerSecond(10, 0), 10 * 1000 / GAME_CONFIG.PRODUCTION_TICK_MS);
    assert.ok(productionPerSecond(10, 5) > productionPerSecond(10, 0));
});


test('demand recovery is independent of the random-event cadence', () => {
    // restoreDemand() used to ride EVENT_CHECK_INTERVAL_MS, so retuning how
    // often accidents are rolled would silently retune the whole economy.
    const level = 8;
    const perSecond = demandThroughputPerSecond(level, 0.4);
    const ticksPerSecond = 1000 / GAME_CONFIG.PRODUCTION_TICK_MS;
    const perTick = demandRestoreStep(level, 0.4);
    // Ceil()-ing to whole clips is the only slack between the two.
    assert.ok(Math.abs(perTick * ticksPerSecond - perSecond) <= ticksPerSecond);
});
