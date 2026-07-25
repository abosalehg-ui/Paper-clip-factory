import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import {
    autoProduceTick,
    autoSellTick,
    restoreDemand,
    isGameOver,
} from './production.js';
import { triggerRandomChallenge } from './events.js';
import { checkAchievements } from './achievements.js';
import { playSound } from './audio.js';
import { showNewsTicker } from './effects.js';
import { updateUI, showGameOverModal } from './ui.js';

// Upper bound on how many logical ticks a single frame may catch up. Protects
// against a long freeze turning into a burst of hundreds of ticks; anything
// longer than this is the visibility catch-up's job, not the loop's.
const MAX_CATCHUP_TICKS = 10;

let lastProductionTime = 0;
let lastSellTime = 0;
let lastEventTime = 0;
let lastRenderTime = 0;
let lastFrameTime = 0;
let running = false;
let gameOverShown = false;

// Fixed-timestep accumulator. The previous version did `last = currentTime`,
// which threw away the remainder past the threshold and quantised the real
// tick period up to the next whole frame — so a 30fps device produced ~2%
// fewer clips per minute than a 60fps one. Advancing by exactly `interval`
// keeps the logical rate independent of frame rate.
export function runFixedSteps(last, interval, currentTime, fn) {
    let iterations = 0;
    while (currentTime - last >= interval && iterations < MAX_CATCHUP_TICKS) {
        fn();
        last += interval;
        iterations++;
    }
    // Still behind after the cap means a long stall: re-anchor to now instead
    // of spending the following frames grinding through a backlog.
    if (currentTime - last >= interval) return currentTime;
    return last;
}

function handleGameOver() {
    if (gameOverShown) return;
    gameOverShown = true;
    running = false;
    const msg = `انتهت اللعبة! 🛑 النقاط النهائية: $${gameState.money.toFixed(2)} (تم بيع: ${gameState.totalSold.toLocaleString()})`;
    showNewsTicker(msg, '🔴', 10000);
    playSound('fail');
    showGameOverModal();
}

function tick(currentTime) {
    if (!running) return;

    if (isGameOver()) {
        handleGameOver();
        return;
    }

    // Monotonic play time, used by the offline-progress guard to detect a
    // wall-clock jump that no amount of real play could account for.
    if (lastFrameTime) {
        gameState.playTimeMs += Math.max(0, Math.min(currentTime - lastFrameTime, 1000));
    }
    lastFrameTime = currentTime;

    lastProductionTime = runFixedSteps(
        lastProductionTime, GAME_CONFIG.PRODUCTION_TICK_MS, currentTime, autoProduceTick,
    );
    lastSellTime = runFixedSteps(
        lastSellTime, GAME_CONFIG.SELL_TICK_MS, currentTime, autoSellTick,
    );
    lastEventTime = runFixedSteps(
        lastEventTime, GAME_CONFIG.EVENT_CHECK_INTERVAL_MS, currentTime, () => {
            restoreDemand();
            triggerRandomChallenge();
            // Catches the achievements that automation earns while the player
            // is not clicking anything.
            checkAchievements();
        },
    );

    // Throttle rendering: state changes at most a few times per second, so
    // there is no need to repaint on every animation frame. updateUI() also
    // refreshes the insurance timer, so no separate timer tick is needed.
    // Manual actions still call updateUI() directly for instant feedback.
    lastRenderTime = runFixedSteps(
        lastRenderTime, GAME_CONFIG.RENDER_TICK_MS, currentTime, updateUI,
    );
    requestAnimationFrame(tick);
}

// Re-anchors all logical timers to "now". Called on start and after the tab
// returns from the background (rAF pauses while hidden), so a long absence
// does not register as one giant elapsed interval.
export function resetLoopTimers() {
    const now = performance.now();
    lastProductionTime = now;
    lastSellTime = now;
    lastEventTime = now;
    lastRenderTime = now;
    lastFrameTime = 0;
}

export function startGameLoop() {
    if (running) return;
    running = true;
    gameOverShown = false;
    resetLoopTimers();
    requestAnimationFrame(tick);
}
