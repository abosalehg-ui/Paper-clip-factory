import './helpers/dom-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { GAME_CONFIG } from '../js/config.js';
import {
    FACTORY_STAGES, factoryStage, factoryStageUrl, iconUrl,
} from '../js/art.js';

const ROOT = new URL('../', import.meta.url);

test('the factory starts as a workshop and grows with the fleet', () => {
    assert.equal(factoryStage(0), 1);
    assert.equal(factoryStage(1), 2);
    assert.equal(factoryStage(24), 2);
    assert.equal(factoryStage(25), 3);
    assert.equal(factoryStage(99), 3);
    assert.equal(factoryStage(100), 4);
    assert.equal(factoryStage(1e6), FACTORY_STAGES.length);
});

test('the final stage is reachable within the starting machine cap', () => {
    const last = FACTORY_STAGES[FACTORY_STAGES.length - 1];
    assert.ok(last.minMachines <= GAME_CONFIG.INITIAL_MAX_CLIPPERS);
});

test('every factory stage has a shipped picture', () => {
    for (let stage = 1; stage <= FACTORY_STAGES.length; stage++) {
        assert.ok(existsSync(new URL(factoryStageUrl(stage), ROOT)), `stage ${stage}`);
    }
});

// A typo'd data-art name would silently keep the emoji forever, so check
// every name the markup asks for against the files on disk.
test('every data-art icon in the markup has a shipped picture', () => {
    const html = readFileSync(new URL('index.html', ROOT), 'utf8');
    const names = [...html.matchAll(/data-art="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(names.length > 0);
    for (const name of names) {
        assert.ok(existsSync(new URL(iconUrl(name), ROOT)), name);
    }
});
