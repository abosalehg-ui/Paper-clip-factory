// Minimal browser-global stubs so the game modules (which touch `window`,
// `document` and `localStorage` at import time and inside helpers) can be
// imported and exercised under Node's built-in test runner without jsdom.
//
// Import this module FIRST in a test file, before any `../js/*` imports, so
// the globals exist by the time those modules are evaluated.
//
// `getElementById` resolves against the ids that actually exist in
// index.html. It used to hand back a live element for ANY id, which meant a
// typo'd or deleted id sailed through the whole suite and only broke in the
// browser — the stub hid exactly the class of bug it was standing in for.
// Unknown ids now return null, like a real document.

import { readFileSync } from 'node:fs';

const HTML_PATH = new URL('../../index.html', import.meta.url);

// Ids declared in the markup. Parsed rather than hard-coded so the stub can
// never drift from the page it is imitating.
export const DOCUMENT_IDS = new Set(
    [...readFileSync(HTML_PATH, 'utf8').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]),
);

function makeElement() {
    return {
        style: {},
        classList: {
            add() {}, remove() {}, toggle() {}, contains: () => false,
        },
        setAttribute() {},
        getAttribute: () => null,
        removeAttribute() {},
        addEventListener() {},
        removeEventListener() {},
        querySelector: () => null,
        querySelectorAll: () => [],
        focus() {},
        append() {},
        appendChild() {},
        remove() {},
        cloneNode() { return makeElement(); },
        play: () => Promise.resolve(),
        pause() {},
        paused: true,
        ended: false,
        currentTime: 0,
        volume: 1,
        textContent: '',
        value: '',
        hidden: false,
        disabled: false,
        offsetWidth: 0,
        dataset: {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    };
}

// Stable identity per id: modules cache the elements they look up, and
// `document.activeElement !== els.price` comparisons need the same object
// back on every call.
const elementsById = new Map();

function elementById(id) {
    if (!DOCUMENT_IDS.has(id)) return null;
    if (!elementsById.has(id)) elementsById.set(id, makeElement());
    return elementsById.get(id);
}

if (!globalThis.window) {
    globalThis.window = {
        matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
        addEventListener() {},
        removeEventListener() {},
    };
}

if (!globalThis.document) {
    globalThis.document = {
        getElementById: elementById,
        createElement: () => makeElement(),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener() {},
        removeEventListener() {},
        body: {
            classList: { add() {}, remove() {}, contains: () => false },
            appendChild() {},
        },
        activeElement: null,
        visibilityState: 'visible',
    };
}

if (!globalThis.localStorage) {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear(),
    };
}

export { makeElement };
