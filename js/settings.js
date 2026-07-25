// Player preferences: persisted separately from the game save so they survive
// "new game", a save import, and a full progress reset. Previously the sound
// toggle lived in a module variable and was silently lost on every reload.

import { STORAGE_KEYS, DEFAULT_KEY_BINDINGS } from './config.js';

const DEFAULTS = {
    soundEnabled: true,
    volume: 0.7,
    // Trophy auras are a large, permanent, high-contrast glow. Separate from
    // prefers-reduced-motion because it is not an animation — nothing else
    // would let a light-sensitive player turn it off.
    reduceFlash: false,
    keyBindings: { ...DEFAULT_KEY_BINDINGS },
};

const settings = { ...DEFAULTS, keyBindings: { ...DEFAULTS.keyBindings } };

const listeners = new Set();

export function onSettingsChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

function notify() {
    for (const fn of listeners) fn(settings);
}

export function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (!raw) return settings;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return settings;

        if (typeof parsed.soundEnabled === 'boolean') settings.soundEnabled = parsed.soundEnabled;
        if (Number.isFinite(parsed.volume)) settings.volume = Math.min(1, Math.max(0, parsed.volume));
        if (typeof parsed.reduceFlash === 'boolean') settings.reduceFlash = parsed.reduceFlash;
        if (parsed.keyBindings && typeof parsed.keyBindings === 'object') {
            for (const action of Object.keys(DEFAULT_KEY_BINDINGS)) {
                const key = parsed.keyBindings[action];
                // One character (or a named key), never an empty string —
                // an empty binding would silently disable the action.
                if (typeof key === 'string' && key.length > 0 && key.length <= 12) {
                    settings.keyBindings[action] = key;
                }
            }
        }
    } catch (e) {
        console.error('Error loading settings:', e);
    }
    notify();
    return settings;
}

export function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
        console.error('Error saving settings:', e);
    }
}

export function getSettings() {
    return settings;
}

export function setSetting(key, value) {
    if (!(key in DEFAULTS)) return false;
    settings[key] = value;
    saveSettings();
    notify();
    return true;
}

// Rebinding refuses duplicates so two actions can never share a key and fight
// over the same press.
export function setKeyBinding(action, key) {
    if (!(action in DEFAULT_KEY_BINDINGS)) return false;
    if (typeof key !== 'string' || !key.length) return false;
    const normalised = key.length === 1 ? key.toLowerCase() : key;
    for (const [other, bound] of Object.entries(settings.keyBindings)) {
        if (other !== action && bound === normalised) return false;
    }
    settings.keyBindings[action] = normalised;
    saveSettings();
    notify();
    return true;
}

export function resetKeyBindings() {
    settings.keyBindings = { ...DEFAULT_KEY_BINDINGS };
    saveSettings();
    notify();
}

// Which action a keypress maps to, or null. Single characters compare
// case-insensitively so Shift does not break a binding.
export function actionForKey(key) {
    if (typeof key !== 'string') return null;
    const needle = key.length === 1 ? key.toLowerCase() : key;
    for (const [action, bound] of Object.entries(settings.keyBindings)) {
        if (bound === needle) return action;
    }
    return null;
}

export function describeKey(key) {
    if (key === ' ') return 'Space';
    if (!key) return '—';
    return key.length === 1 ? key.toUpperCase() : key;
}
