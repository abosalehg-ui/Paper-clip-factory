import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { gameState, createDefaultGameState } from '../js/state.js';
import {
    makeClip, sellClips, buyWire, autoProduceTick, autoSellTick,
} from '../js/production.js';

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
});

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

test('sellClips sells up to demand and reduces demand', () => {
    gameState.clips = 100;
    gameState.demand = 50;
    gameState.price = 0.25;
    const ok = sellClips(null);
    assert.equal(ok, true);
    assert.equal(gameState.clips, 50);
    assert.equal(gameState.totalSold, 50);
    assert.equal(gameState.money, 12.5);
    // demand floor: max(10, 50 - floor(50 * 0.1)) = 45
    assert.equal(gameState.demand, 45);
});

test('sellClips fails with no clips', () => {
    gameState.clips = 0;
    assert.equal(sellClips(null), false);
});

test('buyWire deducts cost and adds wire scaled by efficiency', () => {
    gameState.money = 20;
    gameState.wireCost = 20;
    gameState.wireEfficiency = 1;
    const ok = buyWire();
    assert.equal(ok, true);
    assert.equal(gameState.money, 0);
    assert.equal(gameState.wire, 2000); // 1000 starting + 1000 purchased
});

test('buyWire fails when money is insufficient', () => {
    gameState.money = 0;
    assert.equal(buyWire(), false);
});

test('autoProduceTick produces one clip per clipper', () => {
    gameState.autoClippers = 10;
    gameState.wire = 100;
    gameState.clips = 0;
    const ok = autoProduceTick();
    assert.equal(ok, true);
    assert.equal(gameState.clips, 10);
    assert.equal(gameState.wire, 90);
});

test('autoProduceTick does not fire when wire is below clipper count', () => {
    gameState.autoClippers = 10;
    gameState.wire = 5;
    const ok = autoProduceTick();
    assert.equal(ok, false);
    assert.equal(gameState.clips, 0);
    assert.equal(gameState.wire, 5);
});

test('autoSellTick is capped at the per-tick maximum', () => {
    gameState.autoSellEnabled = true;
    gameState.clips = 1000;
    gameState.demand = 1000;
    gameState.price = 1;
    const ok = autoSellTick();
    assert.equal(ok, true);
    assert.equal(gameState.clips, 990); // capped at 10 per tick
    assert.equal(gameState.money, 10);
});
