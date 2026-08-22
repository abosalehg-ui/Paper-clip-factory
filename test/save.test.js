import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import { gameState, createDefaultGameState } from '../js/state.js';
import { maxPrice } from '../js/economy.js';
import { exportSaveString, importSaveString, resetGameState } from '../js/save.js';

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
});

// Mirrors exportSaveString's encoding so a hand-built payload can be imported.
function encodeSave(payload) {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
}

test('export/import round-trips the full game state', () => {
    gameState.clips = 123;
    gameState.money = 45.67;
    gameState.autoClippers = 9;
    gameState.marketingLevel = 3;
    gameState.prestigePoints = 2;
    gameState.unlockedAchievements = ['first-clip', 'first-sale'];
    const encoded = exportSaveString();
    assert.ok(encoded.length > 0);

    Object.assign(gameState, createDefaultGameState());
    assert.equal(importSaveString(encoded), true);
    assert.equal(gameState.clips, 123);
    assert.equal(gameState.money, 45.67);
    assert.equal(gameState.autoClippers, 9);
    assert.equal(gameState.marketingLevel, 3);
    assert.equal(gameState.prestigePoints, 2);
    assert.deepEqual(gameState.unlockedAchievements, ['first-clip', 'first-sale']);
});

test('import rejects garbage input without touching the state', () => {
    gameState.clips = 55;
    assert.equal(importSaveString('not-base64 at all!!'), false);
    assert.equal(gameState.clips, 55);
});

test('an imported save cannot smuggle in an impossible price', () => {
    const encoded = encodeSave({
        ...createDefaultGameState(), price: 1_000_000, marketingLevel: 1, demand: 1e6,
    });
    assert.equal(importSaveString(encoded), true);
    assert.ok(gameState.price <= maxPrice(gameState.marketingLevel));
    assert.ok(gameState.demand <= GAME_CONFIG.DEMAND_CAP_PER_LEVEL * gameState.marketingLevel);
});

test('resetGameState keeps prestige progress by default', () => {
    gameState.prestigePoints = 7;
    gameState.prestigeResets = 3;
    gameState.lifetimeSold = 900_000;
    gameState.unlockedAchievements = ['first-clip'];
    gameState.clips = 500;
    gameState.money = 999;

    resetGameState();

    assert.equal(gameState.clips, 0, 'the run itself resets');
    assert.equal(gameState.money, 0);
    assert.equal(gameState.prestigePoints, 7, 'permanent progression survives');
    assert.equal(gameState.prestigeResets, 3);
    assert.equal(gameState.lifetimeSold, 900_000);
    assert.deepEqual(gameState.unlockedAchievements, ['first-clip']);
});

test('a full wipe clears prestige too', () => {
    gameState.prestigePoints = 7;
    gameState.lifetimeSold = 900_000;
    gameState.unlockedAchievements = ['first-clip'];

    resetGameState({ keepPrestige: false });

    assert.equal(gameState.prestigePoints, 0);
    assert.equal(gameState.lifetimeSold, 0);
    assert.deepEqual(gameState.unlockedAchievements, []);
});

test('a reset run starts from the documented defaults', () => {
    gameState.wire = 0;
    gameState.marketingLevel = 40;
    resetGameState();
    assert.equal(gameState.wire, GAME_CONFIG.INITIAL_WIRE);
    assert.equal(gameState.marketingLevel, 1);
    assert.equal(gameState.price, GAME_CONFIG.INITIAL_PRICE);
});

// ---- Partial saves must not leak the running game -------------------------
// applySavedState skipped fields the payload did not carry, and `gameState` is
// a module singleton that lives for the whole session. Importing over a run in
// progress therefore kept that run's money, marketing level and prestige
// points while the confirm dialog promised to replace them — and every old
// save would have been silently grandfathered the day a field was added.

test('importing a partial save replaces the run instead of merging into it', () => {
    gameState.autoClippers = 500;
    gameState.money = 9_000_000;
    gameState.marketingLevel = 40;
    gameState.prestigePoints = 30;
    gameState.wireEfficiency = 9;
    gameState.maxClippersLimit = 100_000;

    assert.equal(importSaveString(encodeSave({ clips: 10, totalClips: 10, price: 0.25 })), true);

    const defaults = createDefaultGameState();
    assert.equal(gameState.clips, 10, 'the fields the save carries are applied');
    assert.equal(gameState.money, defaults.money, 'money must not survive the import');
    assert.equal(gameState.marketingLevel, defaults.marketingLevel);
    assert.equal(gameState.prestigePoints, defaults.prestigePoints);
    assert.equal(gameState.wireEfficiency, defaults.wireEfficiency);
    assert.equal(gameState.autoClippers, defaults.autoClippers);
});

test('a save missing a field falls back to that field default, not the live value', () => {
    gameState.autoSellEnabled = true;
    gameState.unlockedAchievements = ['first-clip', 'rich'];
    gameState.trophyGold = true;

    importSaveString(encodeSave({ clips: 5 }));

    assert.equal(gameState.autoSellEnabled, false);
    assert.deepEqual(gameState.unlockedAchievements, []);
    assert.equal(gameState.trophyGold, false);
});

// ---- Prestige carries lifetime progress, not just points ------------------

test('a prestige reset keeps trophies, achievements and the tutorial', () => {
    gameState.trophyBronze = true;
    gameState.trophySilver = true;
    gameState.unlockedAchievements = ['first-clip'];
    gameState.onboardingStep = 5;
    gameState.priceExplored = true;
    gameState.prestigePoints = 3;
    gameState.lifetimeSold = 400_000;
    gameState.totalSold = 120_000;
    gameState.money = 5000;

    resetGameState({ keepPrestige: true });

    // Lifetime awards survive: replaying the same three trophy fanfares every
    // reset read as noise, not celebration.
    assert.equal(gameState.trophyBronze, true);
    assert.equal(gameState.trophySilver, true);
    assert.deepEqual(gameState.unlockedAchievements, ['first-clip']);
    assert.equal(gameState.onboardingStep, 5, 'the tutorial is learned once, not once per run');
    assert.equal(gameState.priceExplored, true);
    assert.equal(gameState.prestigePoints, 3);
    assert.equal(gameState.lifetimeSold, 400_000);
    // The run itself is gone.
    assert.equal(gameState.totalSold, 0);
    assert.equal(gameState.money, 0);
});

test('a full reset throws the trophies away as well', () => {
    gameState.trophyGold = true;
    gameState.prestigePoints = 7;
    resetGameState({ keepPrestige: false });
    assert.equal(gameState.trophyGold, false);
    assert.equal(gameState.prestigePoints, 0);
});
