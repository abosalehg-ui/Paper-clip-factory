import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import { gameState, createDefaultGameState } from '../js/state.js';
import { calculateOfflineProgress } from '../js/offline.js';
import { markClockAnchor, clearClockAnchor, trustedElapsedMs } from '../js/clock.js';

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
    // No monotonic anchor: the fresh-page-load path, where wall time is all
    // there is.
    clearClockAnchor();
});

test('no offline production without clippers', () => {
    gameState.autoClippers = 0;
    gameState.lastSaveTime = Date.now() - 60_000;
    assert.equal(calculateOfflineProgress().clipsProduced, 0);
});

test('very short absences are ignored', () => {
    gameState.autoClippers = 10;
    gameState.lastSaveTime = Date.now() - 1_000; // < 5s threshold
    assert.equal(calculateOfflineProgress().clipsProduced, 0);
});

test('offline production consumes all remaining wire', () => {
    gameState.autoClippers = 10;
    gameState.wire = 95;
    gameState.clips = 0;
    gameState.autoSellEnabled = false;
    gameState.lastSaveTime = Date.now() - 60_000;

    const progress = calculateOfflineProgress();
    assert.equal(progress.clipsProduced, 95);
    assert.equal(gameState.wire, 0);
    assert.equal(gameState.clips, 95);
});

test('offline production is bound by elapsed ticks when wire is plentiful', () => {
    gameState.autoClippers = 10;
    gameState.wire = 10_000;
    gameState.clips = 0;
    gameState.autoSellEnabled = false;
    gameState.lastSaveTime = Date.now() - 10_000; // 10 ticks of one second

    assert.equal(calculateOfflineProgress().clipsProduced, 100);
});

test('offline production is bound by warehouse space when nothing is selling', () => {
    gameState.autoClippers = 100;
    gameState.wire = 10_000;
    gameState.clips = 0;
    gameState.maxClipsLimit = 500;
    gameState.autoSellEnabled = false;
    gameState.lastSaveTime = Date.now() - 60_000;

    assert.equal(calculateOfflineProgress().clipsProduced, 500);
});

test('offline auto-sell drains the warehouse so production keeps going', () => {
    // The old hand-written "mirror" of the production loop measured warehouse
    // space once, up front, and capped the whole absence by it — ignoring that
    // the auto-seller would have been emptying the warehouse the entire time.
    // Players were under-credited by exactly that amount.
    gameState.autoClippers = 100;
    gameState.wire = 1_000_000;
    gameState.clips = 0;
    gameState.maxClipsLimit = 500;
    gameState.demand = 100;
    gameState.price = 0.25;
    gameState.autoSellEnabled = true;
    gameState.lastSaveTime = Date.now() - 60_000;

    const progress = calculateOfflineProgress();
    assert.ok(
        progress.clipsProduced > 500,
        `expected production past the one-off warehouse cap, got ${progress.clipsProduced}`,
    );
    assert.ok(progress.clipsSold > 0);
    assert.ok(progress.moneyEarned > 0);
    assert.equal(gameState.totalSold, progress.clipsSold);
});

test('offline progress is capped no matter how long the absence claims to be', () => {
    gameState.autoClippers = 1;
    gameState.wire = 1e9;
    gameState.maxClipsLimit = 1e9;
    gameState.autoSellEnabled = false;
    gameState.lastSaveTime = Date.now() - 365 * 24 * 3600 * 1000;

    const progress = calculateOfflineProgress();
    assert.equal(progress.elapsedMs, GAME_CONFIG.OFFLINE_PROGRESS_CAP_MS);
    assert.ok(progress.clipsProduced <= GAME_CONFIG.OFFLINE_PROGRESS_CAP_MS / 1000);
});

test('offline replay does not fire random events', () => {
    // Being robbed while away is a punishment the player cannot react to.
    gameState.autoClippers = 10;
    gameState.wire = 100_000;
    gameState.money = 100_000;
    gameState.autoSellEnabled = false;
    gameState.lastSaveTime = Date.now() - 60_000;

    calculateOfflineProgress();
    assert.equal(gameState.money, 100_000);
});

test('a wound-forward clock cannot mint offline progress inside a session', () => {
    // With a monotonic anchor from this page session, a wall-clock jump larger
    // than the monotonic clock's own progress is not credited.
    markClockAnchor();
    const claimed = 8 * 3600 * 1000;
    assert.ok(trustedElapsedMs(claimed) < claimed);

    gameState.autoClippers = 100;
    gameState.wire = 1e9;
    gameState.maxClipsLimit = 1e9;
    gameState.autoSellEnabled = false;
    gameState.lastSaveTime = Date.now() - claimed;

    const progress = calculateOfflineProgress();
    assert.ok(
        progress.clipsProduced < 100 * 3600,
        `a full hour of production was credited for a faked absence (${progress.clipsProduced})`,
    );
});

test('small clock disagreements are tolerated rather than clawed back', () => {
    markClockAnchor();
    // Well inside the tolerance for OS suspend / timer coalescing.
    assert.equal(trustedElapsedMs(30_000), 30_000);
});
