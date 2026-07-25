import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import { autoProduceTick, autoSellTick, restoreDemand } from './production.js';
import { withoutFeedback } from './feedback.js';
import { trustedElapsedMs } from './clock.js';

// Anything shorter than this is treated as noise (a quick tab flick), not an
// absence worth paying out.
const MIN_OFFLINE_MS = 5000;

// Offline progress replays the *real* production and sale ticks rather than
// approximating them with a parallel formula. The previous version carried a
// hand-written "mirror" of autoProduceTick/autoSellTick, which had already
// drifted: it capped production by the warehouse space measured once up
// front, ignoring that the auto-seller would have been draining the warehouse
// the whole time — so players were under-credited.
//
// Random events are deliberately not replayed: being robbed while away is
// punishing in a way the player cannot react to.
export function calculateOfflineProgress() {
    const now = Date.now();
    const lastSave = gameState.lastSaveTime || now;
    const wallElapsed = Math.max(0, now - lastSave);
    let elapsedMs = trustedElapsedMs(wallElapsed);

    if (elapsedMs < MIN_OFFLINE_MS) {
        return { elapsedMs: 0, clipsProduced: 0, clipsSold: 0, moneyEarned: 0 };
    }

    elapsedMs = Math.min(elapsedMs, GAME_CONFIG.OFFLINE_PROGRESS_CAP_MS);

    const before = {
        totalClips: gameState.totalClips,
        totalSold: gameState.totalSold,
        money: gameState.money,
    };

    withoutFeedback(() => {
        let t = 0;
        let nextSell = GAME_CONFIG.SELL_TICK_MS;
        let nextRestore = GAME_CONFIG.EVENT_CHECK_INTERVAL_MS;

        while (t + GAME_CONFIG.PRODUCTION_TICK_MS <= elapsedMs) {
            t += GAME_CONFIG.PRODUCTION_TICK_MS;
            autoProduceTick();
            while (t >= nextSell) {
                autoSellTick();
                nextSell += GAME_CONFIG.SELL_TICK_MS;
            }
            while (t >= nextRestore) {
                restoreDemand();
                nextRestore += GAME_CONFIG.EVENT_CHECK_INTERVAL_MS;
            }
        }
    });

    gameState.lastSaveTime = now;

    return {
        elapsedMs,
        clipsProduced: gameState.totalClips - before.totalClips,
        clipsSold: gameState.totalSold - before.totalSold,
        moneyEarned: gameState.money - before.money,
    };
}
