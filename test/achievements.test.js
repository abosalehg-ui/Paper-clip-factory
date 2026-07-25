import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { gameState, createDefaultGameState, bestLocalScore, resetBestLocalScore } from '../js/state.js';
import {
    checkLocalRecord, resetRecordTracking,
    ACHIEVEMENTS, checkAchievements, isAchievementUnlocked,
} from '../js/achievements.js';

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

// ---- Achievement tree ----------------------------------------------------
// The long tail of goals the game was missing: after the gold trophy there
// was nothing left to ask of the player.

test('achievement ids are unique', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
});

test('every achievement is fully described', () => {
    for (const achievement of ACHIEVEMENTS) {
        assert.ok(achievement.title, `${achievement.id} has no title`);
        assert.ok(achievement.desc, `${achievement.id} has no description`);
        assert.ok(achievement.icon, `${achievement.id} has no icon`);
        assert.equal(typeof achievement.test, 'function');
    }
});

test('a fresh state has unlocked nothing', () => {
    assert.deepEqual(checkAchievements(), []);
    assert.equal(gameState.unlockedAchievements.length, 0);
});

test('meeting a condition unlocks exactly once', () => {
    gameState.totalClips = 1;
    const first = checkAchievements();
    assert.ok(first.some((a) => a.id === 'first-clip'));
    assert.equal(isAchievementUnlocked('first-clip'), true);

    // Re-checking must not re-award it.
    const second = checkAchievements();
    assert.equal(second.some((a) => a.id === 'first-clip'), false);
    assert.equal(gameState.unlockedAchievements.filter((id) => id === 'first-clip').length, 1);
});

test('several achievements can unlock in one pass', () => {
    gameState.totalClips = 1;
    gameState.totalSold = 1;
    gameState.autoClippers = 10;
    const unlocked = checkAchievements().map((a) => a.id);
    assert.ok(unlocked.includes('first-clip'));
    assert.ok(unlocked.includes('first-sale'));
    assert.ok(unlocked.includes('first-machine'));
    assert.ok(unlocked.includes('ten-machines'));
});

test('every achievement is reachable by some state', () => {
    // Guards against a typo'd condition that can never be satisfied.
    Object.assign(gameState, {
        totalClips: 1e9, totalSold: 1e9, autoClippers: 1e6, money: 1e9,
        marketingLevel: 1e3, wireEfficiency: 1e3, maxClipsLimit: 1e9,
        insuranceLevel: 10, prestigeResets: 10,
    });
    for (const achievement of ACHIEVEMENTS) {
        assert.equal(achievement.test(gameState), true, `${achievement.id} is unreachable`);
    }
});
