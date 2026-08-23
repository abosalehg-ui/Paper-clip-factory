import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import { gameState, createDefaultGameState } from '../js/state.js';
import {
    chokePrice, effectiveDemandCap, demandFloor, autoSellPriceFactor, maxPrice,
} from '../js/economy.js';
import {
    makeClip, sellClips, buyWire, setPrice, adjustPrice,
    autoProduceTick, autoSellTick, restoreDemand, isGameOver,
    resetInputCooldowns, canSellNow, productionPerTick, manualMakeRate,
} from '../js/production.js';

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
    resetInputCooldowns();
});

// ---- Production ----------------------------------------------------------

test('makeClip consumes wire and produces a clip', () => {
    const ok = makeClip(null);
    assert.equal(ok, true);
    assert.equal(gameState.clips, 1);
    assert.equal(gameState.totalClips, 1);
    assert.equal(gameState.wire, 999);
});

test('makeClip fails with no wire', () => {
    gameState.wire = 0;
    assert.equal(makeClip(null), false);
    assert.equal(gameState.clips, 0);
});

test('makeClip fails when the warehouse is full', () => {
    gameState.clips = gameState.maxClipsLimit;
    assert.equal(makeClip(null), false);
});

test('autoProduceTick produces one clip per clipper', () => {
    gameState.autoClippers = 10;
    gameState.wire = 100;
    gameState.clips = 0;
    assert.equal(autoProduceTick(), true);
    assert.equal(gameState.clips, 10);
    assert.equal(gameState.wire, 90);
});

test('autoProduceTick produces partially when wire is below clipper count', () => {
    gameState.autoClippers = 10;
    gameState.wire = 5;
    assert.equal(autoProduceTick(), true);
    assert.equal(gameState.clips, 5); // the remaining wire is still used
    assert.equal(gameState.wire, 0);
    assert.equal(gameState.autoClipperRate, 5); // rate reflects actual output
});

test('autoProduceTick reports a zero rate when nothing can be produced', () => {
    gameState.autoClippers = 10;
    gameState.autoClipperRate = 10;
    gameState.wire = 0;
    assert.equal(autoProduceTick(), false);
    assert.equal(gameState.autoClipperRate, 0);
});

test('prestige points multiply production permanently', () => {
    gameState.autoClippers = 100;
    assert.equal(productionPerTick(), 100);
    gameState.prestigePoints = 4; // x1.04 each, compounding
    const expected = Math.floor(100 * (1 + GAME_CONFIG.PRESTIGE_BONUS_PER_POINT) ** 4);
    assert.equal(productionPerTick(), expected);
    assert.ok(expected > 100);

    gameState.wire = 1000;
    gameState.clips = 0;
    autoProduceTick();
    assert.equal(gameState.clips, expected);
});

// ---- Pricing: the exploit that broke the economy -------------------------

test('setPrice refuses to go past the choke price', () => {
    // Typing a huge number into the visible, contenteditable price field used
    // to be accepted verbatim: no upper bound existed at all.
    assert.equal(setPrice(1_000_000), true);
    assert.equal(gameState.price, maxPrice(gameState.marketingLevel));
    assert.ok(gameState.price <= chokePrice(gameState.marketingLevel));
});

test('setPrice rejects junk and leaves the price untouched', () => {
    const before = gameState.price;
    assert.equal(setPrice(NaN), false);
    assert.equal(setPrice(0), false);
    assert.equal(setPrice(-5), false);
    assert.equal(setPrice(Infinity), false);
    assert.equal(gameState.price, before);
});

test('a high price cannot be paired with high demand', () => {
    gameState.demand = 10_000;
    setPrice(chokePrice(gameState.marketingLevel));
    assert.equal(gameState.demand, effectiveDemandCap(gameState.marketingLevel, gameState.price));
    assert.equal(gameState.demand, 1);
});

test('restoreDemand cannot push demand past what the price supports', () => {
    setPrice(chokePrice(gameState.marketingLevel) * 0.9);
    const cap = effectiveDemandCap(gameState.marketingLevel, gameState.price);
    for (let i = 0; i < 500; i++) restoreDemand();
    assert.equal(gameState.demand, cap);
    assert.ok(cap < GAME_CONFIG.DEMAND_CAP_PER_LEVEL);
});

test('adjustPrice stops at the ceiling and at the floor', () => {
    for (let i = 0; i < 1000; i++) adjustPrice(GAME_CONFIG.PRICE_ADJUST_DELTA);
    assert.ok(gameState.price <= maxPrice(gameState.marketingLevel));

    for (let i = 0; i < 5000; i++) adjustPrice(-GAME_CONFIG.PRICE_ADJUST_DELTA);
    assert.equal(gameState.price, GAME_CONFIG.MIN_PRICE);
});

// ---- Selling -------------------------------------------------------------

test('sellClips sells up to demand and consumes it', () => {
    gameState.clips = 100;
    gameState.demand = 50;
    gameState.price = 0.25;
    assert.equal(sellClips(null), true);
    assert.equal(gameState.clips, 50);
    assert.equal(gameState.totalSold, 50);
    assert.equal(gameState.money, 12.5);
    // Demand is a stock now: what was sold is gone until restoreDemand() runs.
    const floorValue = demandFloor(gameState.marketingLevel, gameState.price);
    assert.equal(
        gameState.demand,
        Math.max(floorValue, 50 - Math.floor(50 * GAME_CONFIG.DEMAND_DECAY_FRACTION)),
    );
    assert.ok(gameState.demand <= 1, 'a sale that big empties the market');
});

test('selling advances lifetime sales as well as the run total', () => {
    gameState.clips = 100;
    gameState.demand = 40;
    sellClips(null);
    assert.equal(gameState.totalSold, 40);
    assert.equal(gameState.lifetimeSold, 40);
});

test('sellClips fails with no clips', () => {
    gameState.clips = 0;
    assert.equal(sellClips(null), false);
});

test('the manual sell cooldown stops key-repeat from beating automation', () => {
    gameState.clips = 10_000;
    gameState.demand = 100;

    assert.equal(canSellNow(), true);
    assert.equal(sellClips(null), true);
    const afterFirst = gameState.totalSold;

    // Hammering the key immediately does nothing until the cooldown expires.
    assert.equal(canSellNow(), false);
    for (let i = 0; i < 50; i++) assert.equal(sellClips(null), false);
    assert.equal(gameState.totalSold, afterFirst, 'no extra sales inside the cooldown');

    resetInputCooldowns();
    assert.equal(sellClips(null), true);
    assert.ok(gameState.totalSold > afterFirst);
});

test('one sale clears the whole available amount, so repeating it is inert', () => {
    // This is why the auto-seller's old "slots" loop could never express a
    // cadence discount: the first sale already took everything.
    Object.assign(gameState, createDefaultGameState());
    gameState.clips = 100_000;
    gameState.demand = 100;
    gameState.price = 0.25;
    resetInputCooldowns();

    sellClips(null);
    assert.equal(gameState.totalSold, 100, 'the sale took min(clips, demand) outright');
    resetInputCooldowns();
    sellClips(null);
    // demandFloor() never returns 0, so the market cannot deadlock — but what
    // is left is a single clip, not another hundred.
    assert.equal(gameState.totalSold, 101, 'nothing meaningful left until demand regenerates');
});

test('idling earns exactly the configured share of active play', () => {
    // The discount rides on the PRICE. Throughput is set by demand
    // regeneration, so it is identical either way — the difference the player
    // feels has to show up in the money, and it does, exactly.
    const setup = () => {
        Object.assign(gameState, createDefaultGameState());
        gameState.clips = 1_000_000;
        gameState.demand = 100;
        gameState.price = 0.25;
        gameState.autoSellEnabled = true;
        resetInputCooldowns();
    };

    setup();
    autoSellTick();
    const idleMoney = gameState.money;
    const idleSold = gameState.totalSold;

    setup();
    sellClips(null);
    const activeMoney = gameState.money;

    assert.equal(idleSold, 100, 'the same clips move either way');
    assert.ok(Math.abs(idleMoney / activeMoney - GAME_CONFIG.AUTO_SELL_EFFICIENCY) < 1e-9,
        `idling paid ${(idleMoney / activeMoney).toFixed(4)} of active play`);
    assert.ok(idleMoney < activeMoney, 'active play must still be worth something');
    assert.equal(autoSellPriceFactor(), GAME_CONFIG.AUTO_SELL_EFFICIENCY);
});

// ---- Manual production rate ---------------------------------------------

test('manual clip-making is rate limited but allows a short burst', () => {
    Object.assign(gameState, createDefaultGameState());
    resetInputCooldowns();
    gameState.wire = 1_000_000;

    const depth = manualMakeRate() * GAME_CONFIG.MANUAL_MAKE_BURST_SECONDS;
    let made = 0;
    // Key auto-repeat fires far faster than any bucket refill.
    for (let i = 0; i < 500; i++) if (makeClip(null)) made++;

    assert.ok(made <= depth + 1, `burst of ${made} exceeded the bucket depth ${depth}`);
    assert.ok(made >= 1, 'the very first press must never be swallowed');
    assert.ok(made < 500, 'holding the key must not outrun the factory');
});

test('the wire-efficiency upgrade raises the manual production ceiling', () => {
    Object.assign(gameState, createDefaultGameState());
    const base = manualMakeRate();
    assert.equal(base, GAME_CONFIG.MANUAL_MAKE_BASE_RATE);
    gameState.wireEfficiency = 3;
    assert.equal(
        manualMakeRate(),
        GAME_CONFIG.MANUAL_MAKE_BASE_RATE + 2 * GAME_CONFIG.MANUAL_MAKE_RATE_PER_EFFICIENCY,
    );
    assert.ok(manualMakeRate() > base);
});

test('auto-sell does nothing when disabled or out of stock', () => {
    gameState.autoSellEnabled = false;
    gameState.clips = 100;
    assert.equal(autoSellTick(), false);

    gameState.autoSellEnabled = true;
    gameState.clips = 0;
    assert.equal(autoSellTick(), false);
});

// ---- Wire ----------------------------------------------------------------

test('buyWire deducts cost and adds wire scaled by efficiency', () => {
    gameState.money = 20;
    gameState.wireEfficiency = 1;
    assert.equal(buyWire(), true);
    assert.equal(gameState.money, 0);
    assert.equal(gameState.wire, 2000); // 1000 starting + 1000 purchased
});

test('buyWire fails when money is insufficient', () => {
    gameState.money = 0;
    assert.equal(buyWire(), false);
});

test('wire price rises with lifetime production, giving efficiency a purpose', () => {
    const startingCost = gameState.wireCost;
    gameState.autoClippers = 1;
    gameState.wire = 1e9;
    gameState.totalClips = GAME_CONFIG.WIRE_COST_SCALE * 2;
    autoProduceTick();
    assert.ok(gameState.wireCost > startingCost);
});

// ---- Game over -----------------------------------------------------------

test('game over needs no wire, no clips and no money for wire', () => {
    gameState.wire = 0;
    gameState.clips = 0;
    gameState.money = 0;
    assert.equal(isGameOver(), true);

    gameState.clips = 1;
    assert.equal(isGameOver(), false, 'clips can still be sold');

    gameState.clips = 0;
    gameState.money = 1e6;
    assert.equal(isGameOver(), false, 'wire is still affordable');
});
