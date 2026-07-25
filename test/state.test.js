import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import { gameState, createDefaultGameState, applySavedState } from '../js/state.js';
import { maxPrice, effectiveDemandCap, computeWireCost } from '../js/economy.js';

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

test('an edited save cannot restore the unbounded-price economy', () => {
    applySavedState({ price: 999_999, marketingLevel: 1, demand: 1e8 });
    assert.ok(gameState.price <= maxPrice(gameState.marketingLevel));
    assert.ok(gameState.demand <= effectiveDemandCap(gameState.marketingLevel, gameState.price));
});

test('the price ceiling follows the marketing level in the save', () => {
    applySavedState({ price: 999_999, marketingLevel: 40 });
    assert.equal(gameState.price, maxPrice(40));
    assert.ok(maxPrice(40) > maxPrice(1));
});

test('derived prices are recomputed rather than trusted', () => {
    applySavedState({ totalClips: GAME_CONFIG.WIRE_COST_SCALE, wireCost: 1 });
    assert.equal(gameState.wireCost, computeWireCost(GAME_CONFIG.WIRE_COST_SCALE));
    assert.ok(gameState.wireCost > GAME_CONFIG.INITIAL_WIRE_COST);
});

test('lifetime sales can never be behind the current run', () => {
    applySavedState({ totalSold: 500_000, lifetimeSold: 0 });
    assert.equal(gameState.lifetimeSold, 500_000);
});

test('achievement lists are sanitised to strings and bounded', () => {
    applySavedState({ unlockedAchievements: ['first-clip', 42, null, { a: 1 }, 'first-sale'] });
    assert.deepEqual(gameState.unlockedAchievements, ['first-clip', 'first-sale']);

    applySavedState({ unlockedAchievements: 'not-an-array' });
    assert.deepEqual(gameState.unlockedAchievements, []);

    applySavedState({ unlockedAchievements: new Array(5000).fill('x') });
    assert.ok(gameState.unlockedAchievements.length <= 200);
});

test('prestige fields are validated like every other number', () => {
    applySavedState({ prestigePoints: -5, prestigeResets: 2.9, lifetimeSold: NaN });
    assert.equal(gameState.prestigePoints, 0);
    assert.equal(gameState.prestigeResets, 2);
    assert.equal(gameState.lifetimeSold, 0);
});
