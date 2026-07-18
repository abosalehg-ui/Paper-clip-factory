import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { gameState, createDefaultGameState } from '../js/state.js';
import { calculateOfflineProgress, exportSaveString, importSaveString } from '../js/save.js';

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

test('offline production consumes all remaining wire (partial ticks allowed)', () => {
    // 95 wire with 10 clippers: like the live autoProduceTick, the last
    // partial tick still converts the trailing 5 wire into clips.
    gameState.autoClippers = 10;
    gameState.wire = 95;
    gameState.clips = 0;
    gameState.autoSellEnabled = false;
    gameState.lastSaveTime = Date.now() - 60_000; // 60s elapsed, not the binding limit

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

test('offline auto-sell per-tick cap scales with marketing level', () => {
    gameState.autoClippers = 100;
    gameState.wire = 100_000;
    gameState.clips = 0;
    gameState.demand = 10_000;
    gameState.price = 1;
    gameState.marketingLevel = 2;
    gameState.autoSellEnabled = true;
    gameState.lastSaveTime = Date.now() - 10_000; // 5 sell ticks of 2s

    const progress = calculateOfflineProgress();
    // cap = 10 * marketingLevel = 20/tick over 5 ticks = 100 clips sold
    assert.equal(progress.clipsSold, 100);
    assert.equal(progress.moneyEarned, 100);
});

test('export/import round-trips the full game state', () => {
    gameState.clips = 123;
    gameState.money = 45.67;
    gameState.autoClippers = 9;
    gameState.marketingLevel = 3;
    const encoded = exportSaveString();
    assert.ok(encoded.length > 0);

    Object.assign(gameState, createDefaultGameState());
    assert.equal(importSaveString(encoded), true);
    assert.equal(gameState.clips, 123);
    assert.equal(gameState.money, 45.67);
    assert.equal(gameState.autoClippers, 9);
    assert.equal(gameState.marketingLevel, 3);
});

test('import rejects garbage input without touching the state', () => {
    gameState.clips = 55;
    assert.equal(importSaveString('not-base64 at all!!'), false);
    assert.equal(gameState.clips, 55);
});
