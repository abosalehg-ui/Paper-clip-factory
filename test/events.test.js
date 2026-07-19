import './helpers/dom-stub.js';
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import { gameState, createDefaultGameState } from '../js/state.js';
import { triggerRandomChallenge } from '../js/events.js';
import { computeAutoClipperCost } from '../js/upgrades.js';

const realRandom = Math.random;

function stubRandom(values) {
    const queue = [...values];
    Math.random = () => (queue.length ? queue.shift() : 0.999);
}

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
});

afterEach(() => {
    Math.random = realRandom;
});

test('no event fires above the base chance roll', () => {
    stubRandom([0.5]);
    assert.equal(triggerRandomChallenge(), false);
});

test('active insurance blocks all events', () => {
    gameState.insuranceEndTime = Date.now() + 60_000;
    stubRandom([0.0, 0.0]);
    assert.equal(triggerRandomChallenge(), false);
});

test('theft takes a flat amount but never goes negative', () => {
    gameState.money = GAME_CONFIG.MONEY_THRESHOLD_FOR_THEFT;
    stubRandom([0.0, 0.0]); // base chance hit, theft sub-chance hit
    assert.equal(triggerRandomChallenge(), true);
    assert.equal(gameState.money, GAME_CONFIG.MONEY_THRESHOLD_FOR_THEFT - GAME_CONFIG.THEFT_AMOUNT);
});

test('machine damage is proportional and de-escalates the machine price', () => {
    gameState.autoClippers = 200;
    gameState.autoClipperCost = computeAutoClipperCost(200);
    // base chance hit; skip theft/fire branches (not eligible); clippers hit
    stubRandom([0.0, 0.0]);
    assert.equal(triggerRandomChallenge(), true);
    const expectedLoss = Math.max(1, Math.floor(200 * GAME_CONFIG.CLIPPER_LOSS_FRACTION));
    assert.equal(gameState.autoClippers, 200 - expectedLoss);
    assert.equal(gameState.autoClipperCost, computeAutoClipperCost(200 - expectedLoss));
});

test('negative PR halves demand but keeps it at least 1', () => {
    gameState.demand = GAME_CONFIG.DEMAND_THRESHOLD_FOR_NEGATIVE_PR;
    stubRandom([0.0, 0.0]);
    assert.equal(triggerRandomChallenge(), true);
    assert.equal(gameState.demand, Math.floor(GAME_CONFIG.DEMAND_THRESHOLD_FOR_NEGATIVE_PR * GAME_CONFIG.NEGATIVE_PR_DEMAND_FACTOR));
});
