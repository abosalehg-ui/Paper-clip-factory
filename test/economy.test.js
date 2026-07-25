import { test } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import {
    chokePrice, maxPrice, optimalPrice, baseDemandCap, effectiveDemandCap,
    demandFloor, demandRestoreStep, computeWireCost, computeAutoClipperCost,
    computeMarketingCost, prestigeMultiplier, pendingPrestigePoints,
    autoSellSlots,
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

test('demand floor and restore step scale with the cap', () => {
    const smallFloor = demandFloor(1, 0.25);
    const bigFloor = demandFloor(50, 0.25);
    assert.ok(bigFloor > smallFloor, 'a flat floor goes irrelevant late-game');
    assert.ok(demandFloor(1, 0.25) >= 1);
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
    assert.equal(prestigeMultiplier(0), 1);
    assert.equal(prestigeMultiplier(2), 1 + 2 * GAME_CONFIG.PRESTIGE_BONUS_PER_POINT);
    assert.equal(prestigeMultiplier(-3), 1);
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

test('the auto-seller runs the manual cadence at the configured discount', () => {
    const manualSlotsPerWindow = GAME_CONFIG.SELL_TICK_MS / GAME_CONFIG.MANUAL_SELL_COOLDOWN_MS;
    assert.equal(
        autoSellSlots(),
        Math.floor(manualSlotsPerWindow * GAME_CONFIG.AUTO_SELL_EFFICIENCY),
    );
    assert.ok(autoSellSlots() >= 1);
    assert.ok(autoSellSlots() < manualSlotsPerWindow, 'idling must not beat clicking');
});
