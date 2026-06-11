// Minimal browser-global stubs so the game modules (which touch `window`,
// `document` and `localStorage` at import time and inside helpers) can be
// imported and exercised under Node's built-in test runner without jsdom.
//
// Import this module FIRST in a test file, before any `../js/*` imports, so
// the globals exist by the time those modules are evaluated.

function makeElement() {
    return {
        style: {},
        classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
        setAttribute() {},
        getAttribute: () => null,
        appendChild() {},
        remove() {},
        textContent: '',
        disabled: false,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
    };
}

if (!globalThis.window) {
    globalThis.window = {
        matchMedia: () => ({ matches: false }),
        addEventListener() {},
    };
}

if (!globalThis.document) {
    globalThis.document = {
        getElementById: () => makeElement(),
        querySelectorAll: () => [],
        addEventListener() {},
        body: { classList: { add() {}, remove() {} } },
        activeElement: null,
    };
}

if (!globalThis.localStorage) {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
    };
}

export {};
