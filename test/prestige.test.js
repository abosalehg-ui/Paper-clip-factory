import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import { gameState, createDefaultGameState } from '../js/state.js';
import {
    pendingPoints, canPrestige, currentMultiplier, soldUntilNextPoint, doPrestige,
} from '../js/prestige.js';

const REQ = GAME_CONFIG.PRESTIGE_REQUIREMENT;

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
});

test('prestige is unavailable before the first threshold', () => {
    gameState.lifetimeSold = REQ - 1;
    assert.equal(pendingPoints(), 0);
    assert.equal(canPrestige(), false);
    assert.equal(doPrestige(), 0, 'a refused prestige must not reset anything');
});

test('prestige awards a point per lifetime threshold and resets the run', () => {
    gameState.lifetimeSold = REQ * 2;
    gameState.totalSold = REQ * 2;
    gameState.clips = 1234;
    gameState.money = 5678;
    gameState.autoClippers = 50;
    gameState.marketingLevel = 12;

    assert.equal(canPrestige(), true);
    assert.equal(doPrestige(), 2);

    assert.equal(gameState.prestigePoints, 2);
    assert.equal(gameState.prestigeResets, 1);
    // The run is wiped...
    assert.equal(gameState.clips, 0);
    assert.equal(gameState.money, 0);
    assert.equal(gameState.autoClippers, 0);
    assert.equal(gameState.marketingLevel, 1);
    assert.equal(gameState.totalSold, 0);
    // ...but the progress that earned the points is not.
    assert.equal(gameState.lifetimeSold, REQ * 2);
});

test('points cannot be claimed twice', () => {
    gameState.lifetimeSold = REQ * 3;
    assert.equal(doPrestige(), 3);
    assert.equal(pendingPoints(), 0);
    assert.equal(canPrestige(), false);
    assert.equal(doPrestige(), 0);

    // More lifetime sales unlock only the new tranche.
    gameState.lifetimeSold = REQ * 5;
    assert.equal(pendingPoints(), 2);
});

test('the multiplier reflects banked points', () => {
    assert.equal(currentMultiplier(), 1);
    gameState.lifetimeSold = REQ * 4;
    doPrestige();
    assert.equal(currentMultiplier(), 1 + 4 * GAME_CONFIG.PRESTIGE_BONUS_PER_POINT);
});

test('the next-point target counts down toward the following threshold', () => {
    gameState.lifetimeSold = REQ * 1.5;
    // One point is pending, so the next one lands at 2x the requirement.
    assert.equal(soldUntilNextPoint(), REQ * 2 - REQ * 1.5);

    gameState.lifetimeSold = 0;
    gameState.prestigePoints = 0;
    assert.equal(soldUntilNextPoint(), REQ);
});
