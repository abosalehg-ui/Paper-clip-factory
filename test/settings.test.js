import './helpers/dom-stub.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { STORAGE_KEYS, DEFAULT_KEY_BINDINGS } from '../js/config.js';
import {
    loadSettings, saveSettings, getSettings, setSetting,
    setKeyBinding, resetKeyBindings, actionForKey, describeKey,
} from '../js/settings.js';

beforeEach(() => {
    localStorage.clear();
    resetKeyBindings();
    setSetting('soundEnabled', true);
    setSetting('volume', 0.7);
    setSetting('reduceFlash', false);
});

test('sound and volume preferences survive a reload', () => {
    // The sound toggle used to live in a module variable and was silently
    // lost on every page load.
    setSetting('soundEnabled', false);
    setSetting('volume', 0.25);
    saveSettings();

    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    assert.ok(raw, 'settings were not persisted');
    const stored = JSON.parse(raw);
    assert.equal(stored.soundEnabled, false);
    assert.equal(stored.volume, 0.25);

    // A reload re-reads exactly that payload.
    loadSettings();
    assert.equal(getSettings().soundEnabled, false);
    assert.equal(getSettings().volume, 0.25);
});

test('volume is clamped into range on load', () => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ volume: 42 }));
    loadSettings();
    assert.equal(getSettings().volume, 1);

    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ volume: -3 }));
    loadSettings();
    assert.equal(getSettings().volume, 0);
});

test('corrupt settings fall back to defaults instead of throwing', () => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, '{not json');
    assert.doesNotThrow(() => loadSettings());
    assert.equal(typeof getSettings().soundEnabled, 'boolean');

    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ soundEnabled: 'yes', volume: 'loud' }));
    loadSettings();
    assert.equal(getSettings().soundEnabled, true);
    assert.equal(typeof getSettings().volume, 'number');
});

test('unknown setting keys are refused', () => {
    assert.equal(setSetting('somethingElse', true), false);
    assert.equal('somethingElse' in getSettings(), false);
});

test('keys can be rebound and are looked up case-insensitively', () => {
    assert.equal(actionForKey('s'), 'sell');
    assert.equal(actionForKey('S'), 'sell');

    assert.equal(setKeyBinding('sell', 'K'), true);
    assert.equal(actionForKey('k'), 'sell');
    assert.equal(actionForKey('s'), null);
});

test('two actions can never share the same key', () => {
    assert.equal(setKeyBinding('sell', DEFAULT_KEY_BINDINGS.wire), false,
        'a duplicate binding would make two actions fight over one press');
    assert.equal(actionForKey(DEFAULT_KEY_BINDINGS.wire), 'wire');
});

test('empty or non-string bindings are refused', () => {
    assert.equal(setKeyBinding('sell', ''), false);
    assert.equal(setKeyBinding('sell', null), false);
    assert.equal(setKeyBinding('nope', 'q'), false);
    assert.equal(actionForKey('s'), 'sell');
});

test('bindings survive a reload and can be reset', () => {
    setKeyBinding('make', 'm');
    loadSettings();
    assert.equal(getSettings().keyBindings.make, 'm');

    resetKeyBindings();
    assert.deepEqual(getSettings().keyBindings, DEFAULT_KEY_BINDINGS);
});

test('key labels are human-readable', () => {
    assert.equal(describeKey(' '), 'Space');
    assert.equal(describeKey('s'), 'S');
    assert.equal(describeKey('ArrowUp'), 'ArrowUp');
    assert.equal(describeKey(''), '—');
});
