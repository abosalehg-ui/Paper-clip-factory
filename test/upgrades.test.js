import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import { gameState, createDefaultGameState } from '../js/state.js';
import { computeMarketingCost, effectiveDemandCap } from '../js/economy.js';
import {
    buyUpgrade, buyAutoClipper, getUpgradeCost, computeAutoClipperCost,
    isInsuranceActive,
} from '../js/upgrades.js';

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
});

test('marketing upgrade deducts cost, raises level and demand', () => {
    gameState.money = computeMarketingCost(1);
    assert.equal(buyUpgrade('marketing'), true);
    assert.equal(gameState.money, 0);
    assert.equal(gameState.marketingLevel, 2);
    assert.ok(gameState.demand > GAME_CONFIG.INITIAL_DEMAND);
});

test('marketing never pushes demand past the price-adjusted cap', () => {
    gameState.money = 1e9;
    for (let i = 0; i < 5; i++) buyUpgrade('marketing');
    assert.ok(gameState.demand <= effectiveDemandCap(gameState.marketingLevel, gameState.price));
});

test('marketing cost escalates between purchases', () => {
    gameState.money = 1e9;
    const first = getUpgradeCost('marketing');
    buyUpgrade('marketing');
    const second = getUpgradeCost('marketing');
    assert.ok(second > first, 'a linear cost curve let marketing swallow the economy');
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
    for (const id of ['efficiency', 'marketing', 'warehouse', 'insurance']) {
        Object.assign(gameState, createDefaultGameState());
        gameState.money = 10_000;
        const cost = getUpgradeCost(id);
        buyUpgrade(id);
        assert.equal(gameState.money, 10_000 - cost, `${id} charged something other than its quoted price`);
    }
});

test('unknown upgrade ids are refused', () => {
    assert.equal(buyUpgrade('nope'), false);
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

test('insurance costs a flat price no matter how often it is bought', () => {
    // It used to escalate (level x 1000) against flat damage, which made it a
    // strictly losing purchase from the second buy onward.
    gameState.money = 1e6;
    const first = getUpgradeCost('insurance');
    buyUpgrade('insurance');
    buyUpgrade('insurance');
    buyUpgrade('insurance');
    assert.equal(getUpgradeCost('insurance'), first);
    assert.equal(first, GAME_CONFIG.INSURANCE_BASE_COST);
    assert.equal(gameState.insuranceLevel, 3);
});

test('insurance activates and extends a protection window', () => {
    gameState.money = 1e6;
    assert.equal(isInsuranceActive(), false);
    assert.equal(buyUpgrade('insurance'), true);
    assert.equal(isInsuranceActive(), true);
    const firstEnd = gameState.insuranceEndTime;
    buyUpgrade('insurance');
    assert.ok(
        gameState.insuranceEndTime >= firstEnd + GAME_CONFIG.INSURANCE_DURATION_MS - 100,
        'a second purchase extends rather than replaces the window',
    );
});
