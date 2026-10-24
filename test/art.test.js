import './helpers/dom-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { GAME_CONFIG } from '../js/config.js';
import {
    FACTORY_STAGES, factoryStage, factoryStageUrl, iconUrl, badgeUrl, trophyUrl, eventUrl,
} from '../js/art.js';
import { ACHIEVEMENTS } from '../js/achievements.js';

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

test('every achievement, the locked state and each trophy has a picture', () => {
    for (const { id } of ACHIEVEMENTS) {
        assert.ok(existsSync(new URL(badgeUrl(id), ROOT)), id);
    }
    assert.ok(existsSync(new URL(badgeUrl('locked'), ROOT)));
    for (const tier of ['bronze', 'silver', 'gold']) {
        assert.ok(existsSync(new URL(trophyUrl(tier), ROOT)), tier);
    }
});

// Scene, trophy and app-icon art is referenced by literal path.
test('every image path named in the markup, manifest and styles exists', () => {
    for (const file of ['index.html', 'manifest.json', 'css/styles.css']) {
        const text = readFileSync(new URL(file, ROOT), 'utf8');
        for (const [path] of text.matchAll(/assets\/images\/[\w./-]+\.(?:webp|png)/g)) {
            assert.ok(existsSync(new URL(path, ROOT)), `${file}: ${path}`);
        }
    }
});

test('every incident in events.js has a picture', () => {
    const text = readFileSync(new URL('js/events.js', ROOT), 'utf8');
    const names = [...text.matchAll(/eventUrl\('([^']+)'\)/g)].map((m) => m[1]);
    assert.equal(names.length, 4);
    for (const name of names) {
        assert.ok(existsSync(new URL(eventUrl(name), ROOT)), name);
    }
});
