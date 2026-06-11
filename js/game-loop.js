import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import {
    autoProduceTick,
    autoSellTick,
    restoreDemand,
    isGameOver,
} from './production.js';
import { triggerRandomChallenge } from './events.js';
import { playSound } from './audio.js';
import { showNewsTicker } from './effects.js';
import { updateUI, showGameOverState } from './ui.js';

let lastProductionTime = 0;
let lastSellTime = 0;
let lastEventTime = 0;
let lastRenderTime = 0;
let running = false;
let gameOverShown = false;

function handleGameOver() {
    if (gameOverShown) return;
    gameOverShown = true;
    gameState.gameOver = true;
    const msg = `انتهت اللعبة! 🛑 النقاط النهائية: $${gameState.money.toFixed(2)} (تم بيع: ${gameState.totalSold.toLocaleString()})`;
    showNewsTicker(msg, '🔴', 60000);
    playSound('fail');
    showGameOverState();
}

function tick(currentTime) {
    if (!running) return;

    if (isGameOver()) {
        handleGameOver();
        return;
    }

    if (currentTime - lastProductionTime >= GAME_CONFIG.PRODUCTION_TICK_MS) {
        autoProduceTick();
        lastProductionTime = currentTime;
    }

    if (currentTime - lastSellTime >= GAME_CONFIG.SELL_TICK_MS) {
        autoSellTick();
        lastSellTime = currentTime;
    }

    if (currentTime - lastEventTime >= GAME_CONFIG.EVENT_CHECK_INTERVAL_MS) {
        restoreDemand();
        triggerRandomChallenge();
        lastEventTime = currentTime;
    }

    // Throttle rendering: state changes at most a few times per second, so
    // there is no need to repaint on every animation frame. updateUI() also
    // refreshes the insurance timer, so no separate timer tick is needed.
    // Manual actions still call updateUI() directly for instant feedback.
    if (currentTime - lastRenderTime >= GAME_CONFIG.RENDER_TICK_MS) {
        updateUI();
        lastRenderTime = currentTime;
    }
    requestAnimationFrame(tick);
}

export function startGameLoop() {
    if (running) return;
    running = true;
    gameOverShown = false;
    const now = performance.now();
    lastProductionTime = now;
    lastSellTime = now;
    lastEventTime = now;
    lastRenderTime = now;
    requestAnimationFrame(tick);
}

export function stopGameLoop() {
    running = false;
}
