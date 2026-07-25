import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import { pendingPrestigePoints, prestigeMultiplier } from './economy.js';
import { resetGameState } from './save.js';
import { playSound } from './audio.js';
import { showNewsTicker } from './effects.js';

// Prestige — the meta-progression the game was missing. Both upgrade tracks
// are exponential, so every run eventually hits a wall; without a way to
// convert a finished run into a permanent head start, the wall was simply the
// end of the game.
//
// Points come from LIFETIME sales, so a reset never destroys the progress
// that earned them, and points already banked are subtracted — you cannot
// claim the same clips twice.

export function pendingPoints() {
    return pendingPrestigePoints(gameState.lifetimeSold, gameState.prestigePoints);
}

export function canPrestige() {
    return pendingPoints() > 0;
}

export function currentMultiplier() {
    return prestigeMultiplier(gameState.prestigePoints);
}

// Sales still needed for the next point.
export function soldUntilNextPoint() {
    const target = (gameState.prestigePoints + pendingPoints() + 1) * GAME_CONFIG.PRESTIGE_REQUIREMENT;
    return Math.max(0, target - gameState.lifetimeSold);
}

export function doPrestige() {
    const points = pendingPoints();
    if (points <= 0) return 0;

    gameState.prestigePoints += points;
    gameState.prestigeResets++;
    // resetGameState carries prestige fields across by default.
    resetGameState({ keepPrestige: true });

    playSound('trophy');
    const bonus = Math.round((currentMultiplier() - 1) * 100);
    showNewsTicker(
        `⭐ إعادة تأسيس! +${points} نقطة — إنتاجك الآن أسرع بنسبة ${bonus}% بشكل دائم.`,
        '🏭',
        6000,
    );
    return points;
}
