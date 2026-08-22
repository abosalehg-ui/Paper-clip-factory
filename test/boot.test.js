// Coverage for the two files the suite used to leave untouched: ui.js and
// main.js are ~900 lines of input and render code, and they are exactly where
// a renamed or deleted element id turns into a dead button in the browser.
//
// The old DOM stub returned a live element for ANY id, so nothing here could
// fail. It now resolves against the real ids in index.html (see
// helpers/dom-stub.js), which makes these assertions meaningful.

import './helpers/dom-stub.js';
import { DOCUMENT_IDS } from './helpers/dom-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { gameState, createDefaultGameState } from '../js/state.js';
import {
    initUI, updateUI, updateAutoSellToggle, renderAchievements, renderSettings,
    renderShortcutHints, getActionButton, getPriceElement, snapMoneyDisplay,
} from '../js/ui.js';
import { DEFAULT_KEY_BINDINGS } from '../js/config.js';

const UI_SOURCE = readFileSync(new URL('../js/ui.js', import.meta.url), 'utf8');
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('every id ui.js looks up actually exists in index.html', () => {
    // The id list in initUI() is a flat array of string literals; pull it back
    // out of the source so this test cannot drift from the code it guards.
    const block = UI_SOURCE.match(/const ids = \[([\s\S]*?)\];/);
    assert.ok(block, 'could not find the id list in initUI()');
    const ids = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    assert.ok(ids.length > 40, `expected the full id list, got ${ids.length}`);

    const missing = ids.filter((id) => !DOCUMENT_IDS.has(id));
    assert.deepEqual(missing, [], `ui.js reads ids that index.html does not define: ${missing}`);
});

test('every data-action in the markup is handled by main.js', () => {
    const actions = [...HTML.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(actions.length > 15);
    const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
    const handlers = main.match(/const actions = \{([\s\S]*?)\n\};/);
    assert.ok(handlers, 'could not find the action map in main.js');

    const unhandled = [...new Set(actions)].filter((a) => !handlers[1].includes(`'${a}'`));
    assert.deepEqual(unhandled, [], `markup fires actions main.js does not handle: ${unhandled}`);
});

test('a full render of a default state completes without touching a missing element', () => {
    Object.assign(gameState, createDefaultGameState());
    initUI();
    snapMoneyDisplay();
    // Any id typo would surface here as a TypeError on null.
    updateUI();
    updateAutoSellToggle();
    renderAchievements();
    renderSettings();
    renderShortcutHints();
});

test('a full render of a late-game state completes too', () => {
    Object.assign(gameState, createDefaultGameState());
    gameState.autoClippers = 4200;
    gameState.money = 9.4e12;
    gameState.clips = 1e9;
    gameState.marketingLevel = 60;
    gameState.prestigePoints = 40;
    gameState.lifetimeSold = 5e8;
    gameState.totalSold = 3e8;
    gameState.insuranceEndTime = Date.now() + 60_000;
    initUI();
    snapMoneyDisplay();
    updateUI();
    updateAutoSellToggle();
    renderAchievements();
});

test('every bindable action resolves to a real button', () => {
    initUI();
    for (const action of Object.keys(DEFAULT_KEY_BINDINGS)) {
        assert.ok(getActionButton(action), `no button wired for the "${action}" shortcut`);
    }
    assert.equal(getActionButton('nonsense'), null);
});

test('the price field is a real input, not a contenteditable span', () => {
    // contenteditable gave mobile players a text keyboard for a decimal number
    // and accepted pasted markup; main.js now reads .value.
    assert.match(HTML, /<input id="price"[^>]*inputmode="decimal"/);
    assert.ok(!/id="price"[^>]*contenteditable/.test(HTML));
    initUI();
    assert.ok(getPriceElement(), 'ui.js must still resolve the price element');
});

test('the markup carries no inline style attributes', () => {
    // Inline style attributes would force `style-src 'unsafe-inline'` and gut
    // the Content-Security-Policy below.
    const inline = [...HTML.matchAll(/\sstyle="[^"]*"/g)].map((m) => m[0].trim());
    assert.deepEqual(inline, [], `inline styles break the CSP: ${inline}`);
});

test('index.html ships a Content-Security-Policy that stays on this origin', () => {
    const meta = HTML.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
    assert.ok(meta, 'no CSP meta tag');
    for (const directive of ["default-src 'self'", "script-src 'self'", "style-src 'self'",
        "connect-src 'self'", "object-src 'none'"]) {
        assert.ok(meta[1].includes(directive), `CSP is missing ${directive}`);
    }
    assert.ok(!meta[1].includes('unsafe-inline'));
    assert.ok(!meta[1].includes('unsafe-eval'));
});

test('no script or font is loaded from a third-party origin', () => {
    const remote = [...HTML.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(remote, [], `CSP forbids these, so they would silently fail: ${remote}`);
    const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
    assert.ok(!/@import|url\(['"]?https?:/.test(css), 'stylesheet reaches off-origin');
});

test('the declared font stack is actually shipped', () => {
    // The stack used to name families the project never bundled, so the
    // "Arabic-first" intent quietly fell back to whatever the OS had.
    const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
    const face = css.match(/@font-face\{[\s\S]*?\}/);
    assert.ok(face, 'no @font-face rule');
    const family = face[0].match(/font-family:'([^']+)'/)[1];
    const stack = css.match(/font-family: "([^"]+)"/)[1];
    assert.equal(family, stack, 'the first family in the stack must be the bundled one');
    const src = face[0].match(/url\('\.\.\/([^']+)'\)/)[1];
    assert.ok(readFileSync(new URL(`../${src}`, import.meta.url)).length > 0);
});
