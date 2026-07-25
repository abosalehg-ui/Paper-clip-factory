import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import { gameState, createDefaultGameState } from '../js/state.js';
import {
    chokePrice, effectiveDemandCap, demandFloor, autoSellSlots, maxPrice,
} from '../js/economy.js';
import {
    makeClip, sellClips, buyWire, setPrice, adjustPrice,
    autoProduceTick, autoSellTick, restoreDemand, isGameOver,
    resetSellCooldown, canSellNow, productionPerTick,
} from '../js/production.js';

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
    resetSellCooldown();
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
    gameState.prestigePoints = 4; // +5% each
    assert.equal(productionPerTick(), 120);

    gameState.wire = 1000;
    gameState.clips = 0;
    autoProduceTick();
    assert.equal(gameState.clips, 120);
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

test('sellClips sells up to demand and reduces demand', () => {
    gameState.clips = 100;
    gameState.demand = 50;
    gameState.price = 0.25;
    assert.equal(sellClips(null), true);
    assert.equal(gameState.clips, 50);
    assert.equal(gameState.totalSold, 50);
    assert.equal(gameState.money, 12.5);
    const floorValue = demandFloor(gameState.marketingLevel, gameState.price);
    assert.equal(gameState.demand, Math.max(floorValue, 50 - Math.floor(50 * 0.1)));
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

    resetSellCooldown();
    assert.equal(sellClips(null), true);
    assert.ok(gameState.totalSold > afterFirst);
});

test('auto-sell performs the discounted manual cadence per tick', () => {
    const setup = () => {
        Object.assign(gameState, createDefaultGameState());
        gameState.autoSellEnabled = true;
        gameState.clips = 100_000;
        gameState.demand = 100;
        gameState.price = 0.25;
        resetSellCooldown();
    };

    // What the same number of manual sales would achieve.
    setup();
    let manualSold = 0;
    for (let i = 0; i < autoSellSlots(); i++) {
        resetSellCooldown();
        const before = gameState.totalSold;
        sellClips(null);
        manualSold += gameState.totalSold - before;
    }

    setup();
    assert.equal(autoSellTick(), true);
    assert.equal(gameState.totalSold, manualSold,
        'one auto tick equals autoSellSlots() manual sales');
});

test('idling stays close to, but below, active play', () => {
    // The old auto-seller was capped at a flat rate while the manual button
    // had no cooldown at all, so clicking beat idling roughly fivefold.
    const setup = () => {
        Object.assign(gameState, createDefaultGameState());
        gameState.clips = 1_000_000;
        gameState.demand = 100;
        gameState.price = 0.25;
        gameState.autoSellEnabled = true;
        resetSellCooldown();
    };

    const WINDOWS = 20;
    setup();
    for (let i = 0; i < WINDOWS; i++) autoSellTick();
    const idleSold = gameState.totalSold;

    setup();
    const manualSlots = GAME_CONFIG.SELL_TICK_MS / GAME_CONFIG.MANUAL_SELL_COOLDOWN_MS;
    for (let i = 0; i < WINDOWS * manualSlots; i++) {
        resetSellCooldown();
        sellClips(null);
    }
    const activeSold = gameState.totalSold;

    const ratio = idleSold / activeSold;
    assert.ok(ratio < 1, 'active play must still be worth something');
    assert.ok(ratio > 0.6, `idling fell too far behind active play (ratio ${ratio.toFixed(2)})`);
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
