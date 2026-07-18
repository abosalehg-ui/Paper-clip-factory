import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { gameState, createDefaultGameState, bestLocalScore, resetBestLocalScore } from '../js/state.js';
import { checkLocalRecord, resetRecordTracking } from '../js/achievements.js';

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
    resetBestLocalScore();
    resetRecordTracking();
});

test('any new record updates the best score, even below the celebration threshold', () => {
    gameState.totalSold = 500;
    gameState.money = 25;
    checkLocalRecord();
    assert.equal(bestLocalScore.totalSold, 500);
    assert.equal(bestLocalScore.money, 25);
    assert.ok(bestLocalScore.date);
});

test('a lower total never overwrites the best score', () => {
    bestLocalScore.totalSold = 1000;
    gameState.totalSold = 400;
    checkLocalRecord();
    assert.equal(bestLocalScore.totalSold, 1000);
});

test('the best score keeps tracking incremental records', () => {
    gameState.totalSold = 100;
    checkLocalRecord();
    gameState.totalSold = 150;
    checkLocalRecord();
    assert.equal(bestLocalScore.totalSold, 150);
});
