import { GAME_CONFIG, STORAGE_KEYS } from './config.js';
import {
    gameState,
    bestLocalScore,
    applySavedState,
    applyBestScore,
    resetBestLocalScore,
    createDefaultGameState,
    serializeState,
} from './state.js';
import { markClockAnchor, clearClockAnchor } from './clock.js';

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
        // Pair every wall-clock save stamp with a monotonic anchor, so the
        // offline calculation can tell real absence from a wound-forward clock.
        markClockAnchor();
        localStorage.setItem(STORAGE_KEYS.GAME_STATE, serializeState());
    } catch (e) {
        console.error('Error saving game state:', e);
    }
    // Best score is updated in memory on every record; persist it alongside
    // the state so quiet (non-celebrated) records survive a page close.
    saveBestScore();
}

// Returns 'loaded', 'empty' (first launch) or 'corrupt'.
//
// A save that cannot be read used to be logged and forgotten: the game started
// fresh and the next auto-save overwrote the broken payload 30 seconds later,
// destroying the last chance of recovering it. It is now parked under its own
// key first, and the caller tells the player.
export function loadGameState() {
    let raw;
    try {
        raw = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    } catch (e) {
        console.error('Error reading game state:', e);
        return 'empty';
    }
    if (!raw) return 'empty';

    try {
        if (applySavedState(JSON.parse(raw))) {
            // A save loaded from disk has no monotonic anchor from this page
            // session — the offline calculation must fall back to wall time.
            clearClockAnchor();
            return 'loaded';
        }
    } catch (e) {
        console.error('Error loading game state:', e);
    }

    try {
        localStorage.setItem(STORAGE_KEYS.GAME_STATE_CORRUPT, raw);
    } catch (e) {
        console.error('Could not back up the unreadable save:', e);
    }
    return 'corrupt';
}

export function resetGameState({ keepPrestige = true } = {}) {
    const defaults = createDefaultGameState();
    // Prestige is permanent progression: a new run keeps the points it earned,
    // otherwise resetting would delete the reward for resetting.
    const carried = keepPrestige
        ? {
            prestigePoints: gameState.prestigePoints,
            prestigeResets: gameState.prestigeResets,
            lifetimeSold: gameState.lifetimeSold,
            unlockedAchievements: gameState.unlockedAchievements.slice(),
            // Trophies are lifetime awards, like achievements. Resetting them
            // meant every prestige replayed the same three fanfares — a
            // celebration the fifth time round reads as noise, and the goal
            // bar visibly walked backwards to "bronze" right after an upgrade.
            trophyBronze: gameState.trophyBronze,
            trophySilver: gameState.trophySilver,
            trophyGold: gameState.trophyGold,
            // The tutorial is learned once, not once per run.
            onboardingStep: gameState.onboardingStep,
            priceExplored: gameState.priceExplored,
        }
        : {};

    for (const key of Object.keys(defaults)) {
        gameState[key] = Array.isArray(defaults[key]) ? [] : defaults[key];
    }
    Object.assign(gameState, carried);

    try {
        localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
    } catch (e) {
        console.error(e);
    }
}

// Base64 of the UTF-8 payload. Byte-compatible with the previous
// escape/unescape implementation, so old exported saves keep importing.
export function exportSaveString() {
    const payload = serializeState();
    try {
        const bytes = new TextEncoder().encode(payload);
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        return btoa(binary);
    } catch (e) {
        console.error('Export encoding failed:', e);
        return '';
    }
}

export function importSaveString(encoded) {
    try {
        const binary = atob(encoded.trim());
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const decoded = new TextDecoder().decode(bytes);
        if (!applySavedState(JSON.parse(decoded))) return false;
        clearClockAnchor();
        saveGameState();
        return true;
    } catch (e) {
        console.error('Import failed:', e);
        return false;
    }
}

export function startAutoSave() {
    // While hidden the rAF loop is paused, so nothing changes — and saving
    // would advance lastSaveTime, eating the away-time credit that the
    // visibility catch-up in main.js pays out on return. Save once on hide,
    // then stay quiet until visible again.
    setInterval(() => {
        if (document.visibilityState === 'hidden') return;
        saveGameState();
    }, GAME_CONFIG.AUTO_SAVE_INTERVAL_MS);
    window.addEventListener('beforeunload', saveGameState);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            saveGameState();
        }
    });
}
