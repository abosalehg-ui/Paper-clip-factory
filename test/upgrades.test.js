import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import { gameState, createDefaultGameState } from '../js/state.js';
import {
    buyUpgrade, buyAutoClipper, getUpgradeCost, computeAutoClipperCost,
    isInsuranceActive,
} from '../js/upgrades.js';

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
});

test('marketing upgrade deducts cost, raises level and demand', () => {
    gameState.money = 100;
    assert.equal(buyUpgrade('marketing'), true);
    assert.equal(gameState.money, 0);
    assert.equal(gameState.marketingLevel, 2);
    assert.equal(gameState.demand, GAME_CONFIG.INITIAL_DEMAND + GAME_CONFIG.MARKETING_DEMAND_BONUS);
});

test('upgrades fail without money and change nothing', () => {
    gameState.money = 10;
    assert.equal(buyUpgrade('warehouse'), false);
    assert.equal(gameState.money, 10);
    assert.equal(gameState.maxClipsLimit, GAME_CONFIG.INITIAL_MAX_CLIPS);
});

test('warehouse upgrade expands the cap and escalates its cost', () => {
    gameState.money = 100;
    assert.equal(buyUpgrade('warehouse'), true);
    assert.equal(gameState.maxClipsLimit, GAME_CONFIG.INITIAL_MAX_CLIPS + GAME_CONFIG.WAREHOUSE_EXPANSION_AMOUNT);
    assert.equal(gameState.warehouseCost, 150);
});

test('getUpgradeCost matches what buyUpgrade charges', () => {
    gameState.money = 10_000;
    const cost = getUpgradeCost('efficiency');
    buyUpgrade('efficiency');
    assert.equal(gameState.money, 10_000 - cost);
});

test('machine cost is a pure function of the owned count', () => {
    assert.equal(computeAutoClipperCost(0), 5);
    assert.equal(
        computeAutoClipperCost(10),
        Math.floor(5 * Math.pow(GAME_CONFIG.AUTO_CLIPPER_COST_MULTIPLIER, 10)),
    );
});

test('buying a machine sets the next cost from the count', () => {
    gameState.money = 100;
    assert.equal(buyAutoClipper(), true);
    assert.equal(gameState.autoClippers, 1);
    assert.equal(gameState.autoClipperCost, computeAutoClipperCost(1));
});

test('machines cannot exceed the factory limit', () => {
    gameState.money = 1e9;
    gameState.autoClippers = gameState.maxClippersLimit;
    assert.equal(buyAutoClipper(), false);
});

test('insurance activates a protection window and escalates cost', () => {
    gameState.money = 1000;
    assert.equal(isInsuranceActive(), false);
    assert.equal(buyUpgrade('insurance'), true);
    assert.equal(isInsuranceActive(), true);
    assert.equal(gameState.insuranceLevel, 1);
    assert.equal(gameState.insuranceCost, GAME_CONFIG.INSURANCE_BASE_COST);
    assert.ok(gameState.insuranceEndTime >= Date.now() + GAME_CONFIG.INSURANCE_DURATION_MS - 100);
});
