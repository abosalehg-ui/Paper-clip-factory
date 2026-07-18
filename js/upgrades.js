import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import { playSound } from './audio.js';
import { flash, showNewsTicker } from './effects.js';

// The machine price is a pure function of how many machines you own, so it
// de-escalates when machines are destroyed by events and stays consistent
// across saves.
export function computeAutoClipperCost(count) {
    return Math.floor(
        GAME_CONFIG.INITIAL_AUTO_CLIPPER_COST *
        Math.pow(GAME_CONFIG.AUTO_CLIPPER_COST_MULTIPLIER, count),
    );
}

// Every upgrade is data: a cost function (single source of truth — the UI
// renders from the same function) and an apply function. Adding an upgrade
// means adding one entry here plus its markup.
export const UPGRADES = {
    marketing: {
        cost: (s) => s.marketingLevel * GAME_CONFIG.MARKETING_BASE_COST,
        apply(s) {
            s.marketingLevel++;
            const cap = GAME_CONFIG.DEMAND_CAP_PER_LEVEL * s.marketingLevel;
            s.demand = Math.min(cap, s.demand + GAME_CONFIG.MARKETING_DEMAND_BONUS);
        },
        flashCards: ['card-demand', 'card-money'],
    },
    warehouse: {
        cost: (s) => s.warehouseCost,
        apply(s) {
            s.maxClipsLimit += GAME_CONFIG.WAREHOUSE_EXPANSION_AMOUNT;
            s.warehouseCost = Math.floor(s.warehouseCost * GAME_CONFIG.WAREHOUSE_COST_MULTIPLIER);
        },
        flashCards: ['card-clips', 'card-money'],
    },
    efficiency: {
        cost: (s) => s.wireEfficiency * GAME_CONFIG.EFFICIENCY_BASE_COST,
        apply(s) {
            s.wireEfficiency += GAME_CONFIG.EFFICIENCY_INCREMENT;
        },
        flashCards: ['card-wire', 'card-money'],
    },
    expansion: {
        cost: (s) => s.expansionCost,
        apply(s) {
            s.maxClippersLimit += GAME_CONFIG.EXPANSION_AMOUNT;
            s.expansionCost = Math.floor(s.expansionCost * GAME_CONFIG.EXPANSION_COST_MULTIPLIER);
        },
        flashCards: ['card-money'],
    },
    insurance: {
        cost: (s) => s.insuranceCost,
        apply(s) {
            s.insuranceLevel++;
            s.insuranceCost = s.insuranceLevel * GAME_CONFIG.INSURANCE_BASE_COST;
            const now = Date.now();
            s.insuranceEndTime = Math.max(s.insuranceEndTime, now) + GAME_CONFIG.INSURANCE_DURATION_MS;
        },
        flashCards: ['card-money'],
        onSuccess() {
            showNewsTicker('🛡️ تم تمديد/تفعيل تأمين المصنع لمدة 5 دقائق!', '👍', 4000);
        },
        onFail() {
            playSound('warning');
            showNewsTicker('❌ لا يوجد مال كافٍ لشراء التأمين!', '💰', 3000);
        },
    },
};

export function getUpgradeCost(id) {
    return UPGRADES[id].cost(gameState);
}

export function buyUpgrade(id) {
    const upgrade = UPGRADES[id];
    if (!upgrade) return false;
    const cost = upgrade.cost(gameState);
    if (gameState.money < cost) {
        if (upgrade.onFail) upgrade.onFail();
        return false;
    }
    gameState.money -= cost;
    upgrade.apply(gameState);
    playSound('buy');
    for (const card of upgrade.flashCards) flash(card);
    if (upgrade.onSuccess) upgrade.onSuccess();
    return true;
}

// Machines are not a plain upgrade: they have a count limit and a
// count-derived price.
export function buyAutoClipper() {
    if (
        gameState.money < gameState.autoClipperCost ||
        gameState.autoClippers >= gameState.maxClippersLimit
    ) {
        return false;
    }
    gameState.money -= gameState.autoClipperCost;
    gameState.autoClippers++;
    gameState.autoClipperCost = computeAutoClipperCost(gameState.autoClippers);
    playSound('buy');
    flash('card-clips');
    flash('card-money');
    return true;
}

export function isInsuranceActive() {
    return gameState.insuranceEndTime > Date.now();
}
