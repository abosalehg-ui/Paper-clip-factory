import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { gameState, createDefaultGameState } from '../js/state.js';
import { calculateOfflineProgress } from '../js/save.js';

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
});

test('no offline production without clippers', () => {
    gameState.autoClippers = 0;
    gameState.lastSaveTime = Date.now() - 60_000;
    const progress = calculateOfflineProgress();
    assert.equal(progress.clipsProduced, 0);
});

test('very short absences are ignored', () => {
    gameState.autoClippers = 10;
    gameState.lastSaveTime = Date.now() - 1_000; // < 5s threshold
    const progress = calculateOfflineProgress();
    assert.equal(progress.clipsProduced, 0);
});

test('offline production mirrors whole-tick wire consumption (no fractional tick)', () => {
    // 95 wire with 10 clippers sustains 9 full ticks (90 clips); the trailing
    // 5 wire is stranded, exactly like the live autoProduceTick guard.
    gameState.autoClippers = 10;
    gameState.wire = 95;
    gameState.clips = 0;
    gameState.autoSellEnabled = false;
    gameState.lastSaveTime = Date.now() - 60_000; // 60s elapsed, not the binding limit

    const progress = calculateOfflineProgress();
    assert.equal(progress.clipsProduced, 90);
    assert.equal(gameState.wire, 5);
    assert.equal(gameState.clips, 90);
});

test('offline production is bound by elapsed ticks when wire is plentiful', () => {
    gameState.autoClippers = 10;
    gameState.wire = 10_000;
    gameState.clips = 0;
    gameState.autoSellEnabled = false;
    gameState.lastSaveTime = Date.now() - 10_000; // 10 ticks of one second

    const progress = calculateOfflineProgress();
    assert.equal(progress.clipsProduced, 100); // 10 clippers * 10 ticks
});

test('offline production is bound by warehouse space', () => {
    gameState.autoClippers = 100;
    gameState.wire = 10_000;
    gameState.clips = 0;
    gameState.maxClipsLimit = 500;
    gameState.autoSellEnabled = false;
    gameState.lastSaveTime = Date.now() - 60_000;

    const progress = calculateOfflineProgress();
    assert.equal(progress.clipsProduced, 500);
});
