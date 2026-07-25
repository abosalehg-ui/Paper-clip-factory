import { getSettings, setSetting, onSettingsChange } from './settings.js';
import { isFeedbackSuspended } from './feedback.js';

const soundCache = {};

// Rapid repeats (clicking, auto-sell cash) used to hard-reset the single
// <audio> element mid-play, clipping the sound. A small pool of clones lets
// a few instances overlap naturally.
const POOL_SIZE = 3;
const soundPools = {};

function applyVolume() {
    const { volume } = getSettings();
    for (const base of Object.values(soundCache)) {
        if (base) base.volume = volume;
    }
    for (const pool of Object.values(soundPools)) {
        for (const audio of pool) audio.volume = volume;
    }
}

export function initAudio() {
    soundCache.click = document.getElementById('clickSound');
    soundCache.cash = document.getElementById('cashSound');
    soundCache.buy = document.getElementById('buySound');
    soundCache.trophy = document.getElementById('trophySound');
    soundCache.warning = document.getElementById('warningSound');
    soundCache.fire = document.getElementById('fireSound');
    soundCache.fail = document.getElementById('failSound');
    soundCache.completion = document.getElementById('completionSound');
    applyVolume();
    onSettingsChange(applyVolume);
}

export function playSound(name) {
    if (isFeedbackSuspended()) return;
    const { soundEnabled, volume } = getSettings();
    if (!soundEnabled || volume <= 0) return;
    const base = soundCache[name];
    if (!base) return;
    try {
        let pool = soundPools[name];
        if (!pool) pool = soundPools[name] = [base];
        let audio = pool.find((a) => a.paused || a.ended);
        if (!audio) {
            if (pool.length < POOL_SIZE) {
                audio = base.cloneNode();
                pool.push(audio);
            } else {
                audio = pool[0];
            }
        }
        audio.volume = volume;
        audio.currentTime = 0;
        audio.play().catch(() => {});
    } catch {
        // Autoplay restrictions or detached elements — never break gameplay.
    }
}

export function setSoundsEnabled(enabled) {
    setSetting('soundEnabled', !!enabled);
}

export function areSoundsEnabled() {
    return getSettings().soundEnabled;
}

export function setVolume(value) {
    const clamped = Math.min(1, Math.max(0, Number(value)));
    if (!Number.isFinite(clamped)) return;
    setSetting('volume', clamped);
    applyVolume();
}

export function getVolume() {
    return getSettings().volume;
}
