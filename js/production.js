import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import { playSound } from './audio.js';
import { createFloatingEmoji, flash } from './effects.js';
import { checkTrophy, checkLocalRecord } from './achievements.js';

export function makeClip(buttonEl) {
    if (gameState.wire < 1 || gameState.clips >= gameState.maxClipsLimit) return false;

    gameState.clips++;
    gameState.totalClips++;
    gameState.wire--;

    if (buttonEl) createFloatingEmoji(buttonEl, '📎', 1);
    playSound('click');
    flash('card-clips');
    flash('card-wire');
    return true;
}

export function sellClips(buttonEl) {
    if (gameState.clips <= 0) return false;

    const sellAmount = Math.min(gameState.clips, gameState.demand);
    gameState.clips -= sellAmount;
    gameState.money += sellAmount * gameState.price;
    gameState.totalSold += sellAmount;
    gameState.demand = Math.max(
        GAME_CONFIG.DEMAND_MIN_AFTER_SALE,
        gameState.demand - Math.floor(sellAmount * GAME_CONFIG.DEMAND_DECAY_FRACTION),
    );

    if (sellAmount > 0) {
        if (buttonEl) createFloatingEmoji(buttonEl, '💵', Math.min(sellAmount, 8));
        playSound('cash');
        checkTrophy(gameState.totalSold);
        checkLocalRecord();
    }

    flash('card-money');
    flash('card-clips');
    return true;
}

export function buyWire() {
    if (gameState.money < gameState.wireCost) return false;
    gameState.money -= gameState.wireCost;
    gameState.wire += GAME_CONFIG.WIRE_PURCHASE_AMOUNT * gameState.wireEfficiency;
    playSound('buy');
    flash('card-wire');
    flash('card-money');
    return true;
}

export function adjustPrice(delta) {
    gameState.price = Math.max(
        GAME_CONFIG.MIN_PRICE,
        Math.round((gameState.price + delta) * 100) / 100,
    );
    if (delta > 0) {
        gameState.demand = Math.max(
            GAME_CONFIG.DEMAND_MIN_ON_PRICE_UP,
            gameState.demand - GAME_CONFIG.PRICE_DEMAND_STEP,
        );
    } else {
        const cap = GAME_CONFIG.DEMAND_CAP_PER_LEVEL * gameState.marketingLevel;
        gameState.demand = Math.min(cap, gameState.demand + GAME_CONFIG.PRICE_DEMAND_STEP);
    }
    flash('card-demand');
}

export function setPrice(newPrice) {
    if (isNaN(newPrice) || newPrice <= 0) return false;
    gameState.price = Math.max(
        GAME_CONFIG.MIN_PRICE,
        Math.round(newPrice * 100) / 100,
    );
    gameState.demand = Math.max(
        GAME_CONFIG.SET_PRICE_DEMAND_MIN,
        gameState.demand - GAME_CONFIG.PRICE_DEMAND_STEP,
    );
    flash('card-demand');
    return true;
}

export function toggleAutoSell() {
    gameState.autoSellEnabled = !gameState.autoSellEnabled;
    return gameState.autoSellEnabled;
}

export function autoProduceTick() {
    if (gameState.autoClippers <= 0 || gameState.wire < gameState.autoClippers) return false;

    const potentialClips = gameState.autoClippers;
    const availableSpace = gameState.maxClipsLimit - gameState.clips;
    const clipsMade = Math.min(potentialClips, availableSpace);

    if (clipsMade > 0) {
        gameState.clips += clipsMade;
        gameState.totalClips += clipsMade;
        gameState.wire -= clipsMade;
        gameState.autoClipperRate = gameState.autoClippers;
        flash('card-clips');
        flash('card-wire');
        return true;
    }
    if (gameState.clips >= gameState.maxClipsLimit) {
        gameState.autoClipperRate = 0;
    }
    return false;
}

export function autoSellTick() {
    if (!gameState.autoSellEnabled || gameState.clips <= 0) return false;

    const sellAmount = Math.min(
        gameState.clips,
        Math.max(
            GAME_CONFIG.AUTO_SELL_MIN_PER_TICK,
            Math.floor(gameState.demand * GAME_CONFIG.AUTO_SELL_DEMAND_FRACTION),
        ),
        GAME_CONFIG.AUTO_SELL_MAX_PER_TICK,
    );
    gameState.clips -= sellAmount;
    gameState.money += sellAmount * gameState.price;
    gameState.totalSold += sellAmount;

    if (sellAmount > 0) {
        playSound('cash');
        checkTrophy(gameState.totalSold);
        checkLocalRecord();
    }
    flash('card-money');
    flash('card-clips');
    return true;
}

export function restoreDemand() {
    const cap = GAME_CONFIG.DEMAND_CAP_PER_LEVEL * gameState.marketingLevel;
    gameState.demand = Math.min(cap, gameState.demand + gameState.marketingLevel);
}

export function isGameOver() {
    return (
        gameState.wire === 0 &&
        gameState.money < gameState.wireCost &&
        gameState.clips === 0
    );
}
