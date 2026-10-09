// Coverage for the fixes from the mihak review: the wire buyer, the machine
// cost rebalance, pinned number formatting, corrupt-save recovery, save
// versioning, the price/demand pump and the trophy render split.

import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GAME_CONFIG, STORAGE_KEYS } from '../js/config.js';
import {
    gameState, createDefaultGameState, applySavedState, migrateSave,
} from '../js/state.js';
import { computeAutoClipperCost, effectiveDemandCap } from '../js/economy.js';
import {
    autoBuyWireTick, productionTick, adjustPrice, setPrice, isGameOver,
} from '../js/production.js';
import { buyUpgrade } from '../js/upgrades.js';
import { calculateOfflineProgress } from '../js/offline.js';
import { clearClockAnchor } from '../js/clock.js';
import { loadGameState, exportSaveString, importSaveString } from '../js/save.js';
import { checkTrophy } from '../js/achievements.js';
import { formatNumber, formatInteger, formatDate } from '../js/format.js';

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
    clearClockAnchor();
    localStorage.clear();
});

// ---- Wire buyer ------------------------------------------------------------

test('the wire buyer does nothing until it is bought', () => {
    gameState.wire = 0;
    gameState.money = 1000;
    assert.equal(autoBuyWireTick(), false);
    assert.equal(gameState.wire, 0);
});

test('the wire buyer is a one-time purchase', () => {
    gameState.money = GAME_CONFIG.WIRE_BUYER_COST * 3;
    assert.equal(buyUpgrade('wireBuyer'), true);
    assert.equal(gameState.wireBuyerOwned, true);
    assert.equal(gameState.money, GAME_CONFIG.WIRE_BUYER_COST * 2);
    assert.equal(buyUpgrade('wireBuyer'), false);
    assert.equal(gameState.money, GAME_CONFIG.WIRE_BUYER_COST * 2);
});

test('the wire buyer restocks only when the spool runs low', () => {
    gameState.wireBuyerOwned = true;
    gameState.autoClippers = 10;
    gameState.money = 1000;

    gameState.wire = 10 * GAME_CONFIG.WIRE_BUYER_BUFFER_TICKS;
    assert.equal(autoBuyWireTick(), false, 'a full buffer must not trigger a purchase');

    gameState.wire = 5;
    assert.equal(autoBuyWireTick(), true);
    assert.equal(gameState.wire, 5 + GAME_CONFIG.WIRE_PURCHASE_AMOUNT);
    assert.ok(gameState.money < 1000);
});

test('the wire buyer never spends money the player does not have', () => {
    gameState.wireBuyerOwned = true;
    gameState.wire = 0;
    gameState.money = 1;
    assert.equal(autoBuyWireTick(), false);
    assert.equal(gameState.money, 1);
});

test('the production tick keeps machines fed when the buyer is owned', () => {
    gameState.wireBuyerOwned = true;
    gameState.autoClippers = 20;
    gameState.wire = 0;
    gameState.money = 1000;
    productionTick();
    assert.equal(gameState.autoClipperRate, 20);
});

test('an owned buyer with money to spend is never game over', () => {
    gameState.wireBuyerOwned = true;
    gameState.wire = 0;
    gameState.clips = 0;
    gameState.money = 0;
    assert.equal(isGameOver(), true);
    gameState.money = 1000;
    assert.equal(isGameOver(), false);
});

test('eight hours away with the buyer produce far more than one spool', () => {
    const setUp = (owned) => {
        Object.assign(gameState, createDefaultGameState());
        Object.assign(gameState, {
            autoClippers: 60, wire: 6000, autoSellEnabled: true,
            marketingLevel: 5, price: 0.6, money: 500, maxClipsLimit: 20000,
            wireBuyerOwned: owned,
        });
        gameState.lastSaveTime = Date.now() - 8 * 3600 * 1000;
        return calculateOfflineProgress();
    };
    const without = setUp(false);
    const withBuyer = setUp(true);
    assert.equal(without.clipsProduced, 6000);
    assert.ok(
        withBuyer.clipsProduced > without.clipsProduced * 50,
        `buyer produced only ${withBuyer.clipsProduced}`,
    );
});

// ---- Machine cost curve ------------------------------------------------------

test('the 100-machine cap is reachable: the 100th machine costs under $15k', () => {
    assert.ok(computeAutoClipperCost(99) < 15000, `got ${computeAutoClipperCost(99)}`);
});

// ---- Save versioning and migration -------------------------------------------

test('exports carry the current save version', () => {
    const decoded = JSON.parse(atob(exportSaveString()));
    assert.equal(decoded.saveVersion, GAME_CONFIG.SAVE_VERSION);
});

test('an unversioned save is migrated and its machine price recomputed', () => {
    const migrated = migrateSave({ autoClippers: 40, autoClipperCost: 999999 });
    assert.equal(migrated.saveVersion, GAME_CONFIG.SAVE_VERSION);
    assert.equal('autoClipperCost' in migrated, false);

    applySavedState({ autoClippers: 40, autoClipperCost: 999999 });
    assert.equal(gameState.autoClipperCost, computeAutoClipperCost(40));
});

test('migration does not mutate the payload it was given', () => {
    const saved = { autoClippers: 3, autoClipperCost: 7 };
    migrateSave(saved);
    assert.equal(saved.autoClipperCost, 7);
});

test('importing a non-object payload is rejected', () => {
    assert.equal(importSaveString(btoa('[1,2,3]')), false);
    assert.equal(importSaveString(btoa('42')), false);
});

// ---- Corrupt save recovery ---------------------------------------------------

test('a missing save reports empty', () => {
    assert.equal(loadGameState(), 'empty');
});

test('an unreadable save is backed up instead of being lost', () => {
    localStorage.setItem(STORAGE_KEYS.GAME_STATE, '{"clips": 12, broken');
    assert.equal(loadGameState(), 'corrupt');
    assert.equal(localStorage.getItem(STORAGE_KEYS.GAME_STATE_CORRUPT), '{"clips": 12, broken');
});

test('a valid save loads', () => {
    localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify({ clips: 12 }));
    assert.equal(loadGameState(), 'loaded');
    assert.equal(gameState.clips, 12);
});

// ---- Price / demand ------------------------------------------------------------

test('cutting the price and typing it back cannot pump demand', () => {
    gameState.price = 0.5;
    gameState.demand = 10;
    for (let i = 0; i < 20; i++) {
        adjustPrice(-GAME_CONFIG.PRICE_ADJUST_DELTA);
        setPrice(0.5);
    }
    assert.equal(gameState.demand, 10);
});

test('raising the price still clamps demand to the new cap', () => {
    gameState.price = 0.1;
    gameState.demand = effectiveDemandCap(1, 0.1);
    adjustPrice(0.5);
    assert.ok(gameState.demand <= effectiveDemandCap(1, gameState.price));
});

// ---- Trophies -------------------------------------------------------------------

test('checkTrophy reports an award once and is quiet afterwards', () => {
    assert.equal(checkTrophy(GAME_CONFIG.TROPHY_BRONZE_THRESHOLD), true);
    assert.equal(gameState.trophyBronze, true);
    assert.equal(checkTrophy(GAME_CONFIG.TROPHY_BRONZE_THRESHOLD + 5), false);
});

test('one check can award several trophies', () => {
    assert.equal(checkTrophy(GAME_CONFIG.TROPHY_GOLD_THRESHOLD), true);
    assert.equal(gameState.trophyBronze && gameState.trophySilver && gameState.trophyGold, true);
});

// ---- Number formatting ------------------------------------------------------------

test('numbers use Latin digits whatever the device locale', () => {
    assert.equal(formatNumber(999), '999');
    assert.equal(formatInteger(12345), '12,345');
    assert.match(formatDate('2026-01-02T03:04:05Z'), /^[^٠-٩]*$/);
    assert.equal(formatDate('not a date'), '—');
});

test('no bare toLocaleString() is left in the game code', () => {
    const files = [
        'main.js', 'ui.js', 'events.js', 'game-loop.js', 'save-ui.js', 'input.js',
    ];
    for (const file of files) {
        const src = readFileSync(new URL(`../js/${file}`, import.meta.url), 'utf8');
        assert.equal(/\.toLocaleString\(\)/.test(src), false, `${file} still calls toLocaleString()`);
    }
});

// ---- Manifest ------------------------------------------------------------------------

test('the manifest does not lock orientation', () => {
    const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
    assert.equal('orientation' in manifest, false);
});
