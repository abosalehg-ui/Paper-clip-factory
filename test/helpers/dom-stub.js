// Minimal browser-global stubs so the game modules (which touch `window`,
// `document` and `localStorage` at import time and inside helpers) can be
// imported and exercised under Node's built-in test runner without jsdom.
//
// Import this module FIRST in a test file, before any `../js/*` imports, so
// the globals exist by the time those modules are evaluated.

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

if (!globalThis.window) {
    globalThis.window = {
        matchMedia: () => ({ matches: false }),
        addEventListener() {},
        removeEventListener() {},
    };
}

if (!globalThis.document) {
    globalThis.document = {
        getElementById: () => makeElement(),
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
