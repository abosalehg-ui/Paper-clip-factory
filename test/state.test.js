import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import { gameState, createDefaultGameState, applySavedState } from '../js/state.js';

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
});

test('applySavedState accepts a normal save', () => {
    applySavedState({ clips: 42, money: 10.5, autoClippers: 3, autoSellEnabled: true });
    assert.equal(gameState.clips, 42);
    assert.equal(gameState.money, 10.5);
    assert.equal(gameState.autoClippers, 3);
    assert.equal(gameState.autoSellEnabled, true);
});

test('applySavedState rejects NaN and Infinity, keeping defaults', () => {
    applySavedState({ price: NaN, wireEfficiency: Infinity, money: NaN });
    assert.equal(gameState.price, GAME_CONFIG.INITIAL_PRICE);
    assert.equal(gameState.wireEfficiency, 1);
    assert.equal(gameState.money, 0);
});

test('applySavedState rejects wrong types', () => {
    applySavedState({ clips: '9999', autoSellEnabled: 'yes', demand: null });
    assert.equal(gameState.clips, 0);
    assert.equal(gameState.autoSellEnabled, false);
    assert.equal(gameState.demand, GAME_CONFIG.INITIAL_DEMAND);
});

test('applySavedState clamps out-of-range values', () => {
    applySavedState({ money: -500, demand: -3, price: 0, wireEfficiency: 0.1 });
    assert.equal(gameState.money, 0);
    assert.equal(gameState.demand, 1);
    assert.equal(gameState.price, GAME_CONFIG.MIN_PRICE);
    assert.equal(gameState.wireEfficiency, 1);
});

test('applySavedState floors integer fields', () => {
    applySavedState({ clips: 10.7, wire: 99.9, autoClippers: 2.5 });
    assert.equal(gameState.clips, 10);
    assert.equal(gameState.wire, 99);
    assert.equal(gameState.autoClippers, 2);
});

test('applySavedState enforces cross-field limits', () => {
    applySavedState({ clips: 999_999, maxClipsLimit: 5000, autoClippers: 500, maxClippersLimit: 100 });
    assert.equal(gameState.clips, 5000);
    assert.equal(gameState.autoClippers, 100);
});

test('applySavedState clamps far-future insurance and lastSaveTime', () => {
    const farFuture = Date.now() + 365 * 24 * 3600 * 1000;
    applySavedState({ insuranceEndTime: farFuture, lastSaveTime: farFuture });
    assert.ok(gameState.insuranceEndTime <= Date.now() + GAME_CONFIG.MAX_INSURANCE_FUTURE_MS);
    assert.ok(gameState.lastSaveTime <= Date.now());
});
