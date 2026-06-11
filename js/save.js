import { GAME_CONFIG, STORAGE_KEYS } from './config.js';
import {
    gameState,
    bestLocalScore,
    applySavedState,
    applyBestScore,
    resetBestLocalScore,
    createDefaultGameState,
} from './state.js';

export function loadBestScore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.BEST_SCORE);
        if (raw) {
            const parsed = JSON.parse(raw);
            applyBestScore(parsed);
        }
    } catch (e) {
        console.error('Error loading bestLocalScore:', e);
    }
}

export function saveBestScore() {
    try {
        const payload = {
            totalSold: bestLocalScore.totalSold,
            money: bestLocalScore.money,
            date: bestLocalScore.date,
        };
        localStorage.setItem(STORAGE_KEYS.BEST_SCORE, JSON.stringify(payload));
    } catch (e) {
        console.error('Error saving bestLocalScore:', e);
    }
}

export function resetBestScore() {
    resetBestLocalScore();
    try {
        localStorage.removeItem(STORAGE_KEYS.BEST_SCORE);
    } catch (e) {
        console.error(e);
    }
}

export function saveGameState() {
    try {
        gameState.lastSaveTime = Date.now();
        const payload = JSON.stringify(gameState);
        localStorage.setItem(STORAGE_KEYS.GAME_STATE, payload);
    } catch (e) {
        console.error('Error saving game state:', e);
    }
}

export function loadGameState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
        if (raw) {
            const parsed = JSON.parse(raw);
            applySavedState(parsed);
            return true;
        }
    } catch (e) {
        console.error('Error loading game state:', e);
    }
    return false;
}

export function resetGameState() {
    const defaults = createDefaultGameState();
    for (const key of Object.keys(defaults)) {
        gameState[key] = defaults[key];
    }
    try {
        localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
    } catch (e) {
        console.error(e);
    }
}

export function exportSaveString() {
    const payload = JSON.stringify(gameState);
    try {
        return btoa(unescape(encodeURIComponent(payload)));
    } catch (e) {
        console.error('Export encoding failed:', e);
        return '';
    }
}

export function importSaveString(encoded) {
    try {
        const decoded = decodeURIComponent(escape(atob(encoded.trim())));
        const parsed = JSON.parse(decoded);
        if (!parsed || typeof parsed !== 'object') return false;
        applySavedState(parsed);
        saveGameState();
        return true;
    } catch (e) {
        console.error('Import failed:', e);
        return false;
    }
}

export function calculateOfflineProgress() {
    const now = Date.now();
    const lastSave = gameState.lastSaveTime || now;
    let elapsedMs = now - lastSave;

    if (elapsedMs < 5000) {
        return { elapsedMs: 0, clipsProduced: 0, moneyEarned: 0 };
    }

    elapsedMs = Math.min(elapsedMs, GAME_CONFIG.OFFLINE_PROGRESS_CAP_MS);
    const elapsedSec = Math.floor(elapsedMs / 1000);

    const clippers = gameState.autoClippers;
    if (clippers <= 0) {
        return { elapsedMs, clipsProduced: 0, moneyEarned: 0 };
    }

    const availableSpace = Math.max(0, gameState.maxClipsLimit - gameState.clips);

    // Mirror autoProduceTick: each 1s tick only fires when wire >= clippers,
    // consuming `clippers` wire per tick, so the wire sustains only whole
    // ticks and any remainder below one tick's worth is stranded (as live).
    const wireTicks = Math.floor(gameState.wire / clippers);
    const firingTicks = Math.min(elapsedSec, wireTicks);
    const clipsProduced = Math.max(0, Math.min(clippers * firingTicks, availableSpace));

    let moneyEarned = 0;
    let clipsSold = 0;
    if (gameState.autoSellEnabled && clipsProduced > 0) {
        const sellPerTick = Math.max(1, Math.floor(gameState.demand * 0.1));
        const ticks = Math.floor(elapsedMs / GAME_CONFIG.SELL_TICK_MS);
        clipsSold = Math.min(clipsProduced, sellPerTick * ticks, 10 * ticks);
        moneyEarned = clipsSold * gameState.price;
    }

    gameState.clips += clipsProduced - clipsSold;
    gameState.totalClips += clipsProduced;
    gameState.wire -= clipsProduced;
    gameState.money += moneyEarned;
    gameState.totalSold += clipsSold;
    gameState.lastSaveTime = now;

    return {
        elapsedMs,
        clipsProduced,
        clipsSold,
        moneyEarned,
    };
}

export function startAutoSave() {
    setInterval(saveGameState, GAME_CONFIG.AUTO_SAVE_INTERVAL_MS);
    window.addEventListener('beforeunload', saveGameState);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            saveGameState();
        }
    });
}
