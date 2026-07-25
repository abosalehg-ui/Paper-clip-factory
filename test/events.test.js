import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import { gameState, createDefaultGameState } from '../js/state.js';
import { triggerRandomChallenge } from '../js/events.js';
import { computeAutoClipperCost } from '../js/economy.js';

// The event system takes an injectable rng, so these run without stubbing
// globals: the first draw decides whether an event fires, the second picks
// which eligible category it hits.
function rngOf(...values) {
    const queue = [...values];
    return () => (queue.length ? queue.shift() : 0);
}

// Isolate a single category by making only that one eligible.
function onlyMoney(amount) {
    gameState.money = amount;
    gameState.clips = 0;
    gameState.autoClippers = 0;
    gameState.demand = GAME_CONFIG.MIN_EVENT_DEMAND - 1;
}

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
});

test('no event fires when the base roll misses', () => {
    assert.equal(triggerRandomChallenge(rngOf(0.99)), false);
});

test('no event fires when the player owns nothing worth losing', () => {
    gameState.money = 0;
    gameState.clips = 0;
    gameState.autoClippers = 0;
    gameState.demand = 1;
    assert.equal(triggerRandomChallenge(rngOf(0, 0)), false);
});

test('theft takes a fraction of wealth, so it still stings when rich', () => {
    onlyMoney(100_000);
    assert.equal(triggerRandomChallenge(rngOf(0, 0)), 'money');
    const expected = 100_000 * (1 - GAME_CONFIG.THEFT_WEALTH_FRACTION);
    assert.ok(Math.abs(gameState.money - expected) < 0.01);
});

test('theft has a floor for small balances and never goes negative', () => {
    onlyMoney(GAME_CONFIG.MIN_EVENT_MONEY);
    assert.equal(triggerRandomChallenge(rngOf(0, 0)), 'money');
    assert.ok(gameState.money >= 0);
    assert.ok(gameState.money < GAME_CONFIG.MIN_EVENT_MONEY);
});

test('insurance blunts damage instead of cancelling the event outright', () => {
    // One purchase used to switch the entire challenge system off forever.
    onlyMoney(100_000);
    gameState.insuranceEndTime = Date.now() + 60_000;

    assert.equal(triggerRandomChallenge(rngOf(0, 0)), 'money',
        'the event still fires while insured');

    const rawLoss = 100_000 * GAME_CONFIG.THEFT_WEALTH_FRACTION;
    const expectedLoss = rawLoss * (1 - GAME_CONFIG.INSURANCE_DAMAGE_REDUCTION);
    assert.ok(Math.abs((100_000 - gameState.money) - expectedLoss) < 0.01);
    assert.ok(100_000 - gameState.money < rawLoss, 'damage was reduced');
});

test('fire destroys a fraction of stock', () => {
    gameState.money = 0;
    gameState.clips = 100_000;
    gameState.autoClippers = 0;
    gameState.demand = GAME_CONFIG.MIN_EVENT_DEMAND - 1;
    assert.equal(triggerRandomChallenge(rngOf(0, 0)), 'clips');
    assert.equal(gameState.clips, 100_000 - Math.floor(100_000 * GAME_CONFIG.FIRE_CLIP_FRACTION));
});

test('machine damage is proportional and de-escalates the machine price', () => {
    gameState.money = 0;
    gameState.clips = 0;
    gameState.autoClippers = 200;
    gameState.autoClipperCost = computeAutoClipperCost(200);
    gameState.demand = GAME_CONFIG.MIN_EVENT_DEMAND - 1;

    assert.equal(triggerRandomChallenge(rngOf(0, 0)), 'clippers');
    const expectedLoss = Math.max(1, Math.floor(200 * GAME_CONFIG.CLIPPER_LOSS_FRACTION));
    assert.equal(gameState.autoClippers, 200 - expectedLoss);
    assert.equal(gameState.autoClipperCost, computeAutoClipperCost(200 - expectedLoss));
});

test('negative PR cuts demand but keeps it at least 1', () => {
    gameState.money = 0;
    gameState.clips = 0;
    gameState.autoClippers = 0;
    gameState.demand = GAME_CONFIG.MIN_EVENT_DEMAND;

    assert.equal(triggerRandomChallenge(rngOf(0, 0)), 'demand');
    assert.ok(gameState.demand >= 1);
    assert.ok(gameState.demand < GAME_CONFIG.MIN_EVENT_DEMAND);
});

test('every eligible category can be selected', () => {
    // The old nested-threshold chain let the first eligible type eat the roll,
    // so later categories almost never fired.
    const seen = new Set();
    for (let i = 0; i < 4; i++) {
        Object.assign(gameState, createDefaultGameState());
        gameState.money = 100_000;
        gameState.clips = 100_000;
        gameState.autoClippers = 100;
        gameState.demand = 100;
        // Second draw indexes into the four eligible candidates.
        seen.add(triggerRandomChallenge(rngOf(0, i / 4)));
    }
    assert.deepEqual([...seen].sort(), ['clippers', 'clips', 'demand', 'money']);
});

test('staying under a threshold is no longer free immunity', () => {
    // Damage scales with holdings, so hoarding just below an absolute
    // threshold does not protect anything any more.
    onlyMoney(GAME_CONFIG.MIN_EVENT_MONEY + 1);
    assert.equal(triggerRandomChallenge(rngOf(0, 0)), 'money');
    assert.ok(gameState.money < GAME_CONFIG.MIN_EVENT_MONEY + 1);
});
