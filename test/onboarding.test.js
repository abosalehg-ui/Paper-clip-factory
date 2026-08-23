import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { GAME_CONFIG } from '../js/config.js';
import { gameState, createDefaultGameState } from '../js/state.js';
import {
    ONBOARDING_STEPS, updateOnboarding, isOnboardingComplete, getNextGoal,
} from '../js/onboarding.js';

beforeEach(() => {
    Object.assign(gameState, createDefaultGameState());
});

test('a new player starts on the first step', () => {
    const step = updateOnboarding();
    assert.equal(step.id, 'make');
    assert.equal(isOnboardingComplete(), false);
    assert.equal(step.progress(gameState), 0);
});

test('each step advances only once its own goal is met', () => {
    assert.equal(updateOnboarding().id, 'make');

    gameState.totalClips = 10;
    assert.equal(updateOnboarding().id, 'sell');

    gameState.totalSold = 1;
    assert.equal(updateOnboarding().id, 'machine');

    gameState.autoClippers = 1;
    assert.equal(updateOnboarding().id, 'autosell');

    gameState.autoSellEnabled = true;
    assert.equal(updateOnboarding().id, 'price');

    gameState.priceExplored = true;
    assert.equal(updateOnboarding(), null);
    assert.equal(isOnboardingComplete(), true);
});

test('the tutorial ends on the pricing step, the one real decision in the game', () => {
    // The four button steps taught the controls; price is what the economy is
    // actually built around, and the tutorial used to skip it entirely.
    assert.equal(ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1].id, 'price');
});

test('a player already past the tutorial is not sent back to the pricing step', () => {
    // Saves written before this step existed carry priceExplored: false.
    gameState.totalClips = 5000;
    gameState.totalSold = 500;
    gameState.autoClippers = 5;
    gameState.autoSellEnabled = true;
    gameState.priceExplored = false;
    assert.equal(updateOnboarding(), null);
});

test('importing a mature save skips the tutorial entirely', () => {
    // Walking an established player back through "make 10 clips" would be
    // absurd, so every satisfied step is consumed at once.
    gameState.totalClips = 500_000;
    gameState.totalSold = 400_000;
    gameState.autoClippers = 80;
    gameState.autoSellEnabled = true;

    assert.equal(updateOnboarding(), null);
    assert.equal(gameState.onboardingStep, ONBOARDING_STEPS.length);
});

test('progress never exceeds the step target', () => {
    gameState.totalClips = 99999;
    const step = ONBOARDING_STEPS[0];
    assert.equal(step.progress(gameState), step.target);
});

test('the standing objective walks the trophy thresholds in order', () => {
    // Measured on lifetime sales, so a prestige reset does not walk the
    // objective backwards to "bronze" right after an upgrade.
    gameState.lifetimeSold = 0;
    assert.equal(getNextGoal().target, GAME_CONFIG.TROPHY_BRONZE_THRESHOLD);

    gameState.lifetimeSold = GAME_CONFIG.TROPHY_BRONZE_THRESHOLD;
    assert.equal(getNextGoal().target, GAME_CONFIG.TROPHY_SILVER_THRESHOLD);

    gameState.lifetimeSold = GAME_CONFIG.TROPHY_SILVER_THRESHOLD;
    assert.equal(getNextGoal().target, GAME_CONFIG.TROPHY_GOLD_THRESHOLD);
});

test('the objective survives a prestige reset instead of restarting', () => {
    gameState.lifetimeSold = GAME_CONFIG.TROPHY_SILVER_THRESHOLD;
    gameState.totalSold = 0; // what a fresh post-prestige run looks like
    assert.equal(getNextGoal().target, GAME_CONFIG.TROPHY_GOLD_THRESHOLD);
});

test('past the trophies the objective becomes the next prestige point', () => {
    gameState.totalSold = GAME_CONFIG.TROPHY_GOLD_THRESHOLD;
    gameState.lifetimeSold = GAME_CONFIG.TROPHY_GOLD_THRESHOLD;
    const goal = getNextGoal();
    assert.equal(goal.current, gameState.lifetimeSold);
    assert.ok(goal.target > gameState.lifetimeSold, 'the target must always be ahead');
});
