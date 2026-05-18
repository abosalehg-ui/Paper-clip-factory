import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import { playSound } from './audio.js';
import { flash, showNewsTicker } from './effects.js';

export function buyAutoClipper() {
    if (
        gameState.money < gameState.autoClipperCost ||
        gameState.autoClippers >= gameState.maxClippersLimit
    ) {
        return false;
    }
    gameState.money -= gameState.autoClipperCost;
    gameState.autoClippers++;
    if (gameState.autoClippers % GAME_CONFIG.INITIAL_MAX_CLIPPERS !== 0) {
        gameState.autoClipperCost = Math.floor(
            gameState.autoClipperCost * GAME_CONFIG.AUTO_CLIPPER_COST_MULTIPLIER,
        );
    }
    playSound('buy');
    flash('card-clips');
    flash('card-money');
    return true;
}

export function increaseMarketing() {
    const cost = gameState.marketingLevel * GAME_CONFIG.MARKETING_BASE_COST;
    if (gameState.money < cost) return false;

    gameState.money -= cost;
    gameState.marketingLevel++;
    const cap = GAME_CONFIG.DEMAND_CAP_PER_LEVEL * gameState.marketingLevel;
    gameState.demand = Math.min(cap, gameState.demand + GAME_CONFIG.MARKETING_DEMAND_BONUS);
    playSound('buy');
    flash('card-demand');
    flash('card-money');
    return true;
}

export function upgradeWarehouse() {
    if (gameState.money < gameState.warehouseCost) return false;
    gameState.money -= gameState.warehouseCost;
    gameState.maxClipsLimit += GAME_CONFIG.WAREHOUSE_EXPANSION_AMOUNT;
    gameState.warehouseCost = Math.floor(
        gameState.warehouseCost * GAME_CONFIG.WAREHOUSE_COST_MULTIPLIER,
    );
    playSound('buy');
    flash('card-clips');
    flash('card-money');
    return true;
}

export function buyWireEfficiency() {
    const cost = gameState.wireEfficiency * GAME_CONFIG.EFFICIENCY_BASE_COST;
    if (gameState.money < cost) return false;
    gameState.money -= cost;
    gameState.wireEfficiency += GAME_CONFIG.EFFICIENCY_INCREMENT;
    playSound('buy');
    flash('card-wire');
    flash('card-money');
    return true;
}

export function buyExpansion() {
    if (gameState.money < gameState.expansionCost) return false;
    gameState.money -= gameState.expansionCost;
    gameState.maxClippersLimit += GAME_CONFIG.EXPANSION_AMOUNT;
    gameState.expansionCost = Math.floor(
        gameState.expansionCost * GAME_CONFIG.EXPANSION_COST_MULTIPLIER,
    );
    playSound('buy');
    flash('card-money');
    return true;
}

export function buyInsurance() {
    if (gameState.money < gameState.insuranceCost) {
        playSound('warning');
        showNewsTicker('❌ لا يوجد مال كافٍ لشراء التأمين!', '💰', 3000);
        return false;
    }
    gameState.money -= gameState.insuranceCost;
    gameState.insuranceLevel++;
    gameState.insuranceCost = gameState.insuranceLevel * GAME_CONFIG.INSURANCE_BASE_COST;
    const now = Date.now();
    gameState.insuranceEndTime = Math.max(gameState.insuranceEndTime, now) + GAME_CONFIG.INSURANCE_DURATION_MS;
    playSound('buy');
    flash('card-money');
    showNewsTicker('🛡️ تم تمديد/تفعيل تأمين المصنع لمدة 5 دقائق!', '👍', 4000);
    return true;
}

export function isInsuranceActive() {
    return gameState.insuranceEndTime > Date.now();
}
