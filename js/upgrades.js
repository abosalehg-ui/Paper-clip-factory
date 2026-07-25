import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import {
    computeAutoClipperCost, computeMarketingCost, effectiveDemandCap,
} from './economy.js';
import { playSound } from './audio.js';
import { flash, showNewsTicker } from './effects.js';

// Re-exported so callers keep a single import site for machine pricing.
export { computeAutoClipperCost };

// Every upgrade is data: a cost function (single source of truth — the UI
// renders from the same function) and an apply function. Adding an upgrade
// means adding one entry here plus its markup.
export const UPGRADES = {
    marketing: {
        // Exponential, like machines. It used to be linear (100 x level),
        // which made it strictly the best buy and let it swallow the economy.
        cost: (s) => computeMarketingCost(s.marketingLevel),
        apply(s) {
            s.marketingLevel++;
            // A higher level widens the demand curve, so re-derive the cap
            // before topping demand up.
            const cap = effectiveDemandCap(s.marketingLevel, s.price);
            s.demand = Math.max(1, Math.min(cap, s.demand + GAME_CONFIG.MARKETING_DEMAND_BONUS));
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
        cost: (s) => Math.floor(s.wireEfficiency * GAME_CONFIG.EFFICIENCY_BASE_COST),
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
        // Flat price. It used to escalate (level x 1000) against flat damage,
        // which made it a strictly losing purchase from the second buy on.
        cost: () => GAME_CONFIG.INSURANCE_BASE_COST,
        apply(s) {
            s.insuranceLevel++;
            s.insuranceCost = GAME_CONFIG.INSURANCE_BASE_COST;
            const now = Date.now();
            s.insuranceEndTime = Math.max(s.insuranceEndTime, now) + GAME_CONFIG.INSURANCE_DURATION_MS;
        },
        flashCards: ['card-money'],
        onSuccess() {
            const pct = Math.round(GAME_CONFIG.INSURANCE_DAMAGE_REDUCTION * 100);
            showNewsTicker(`🛡️ التأمين نشط 5 دقائق — يقلّل ضرر الحوادث ${pct}%!`, '👍', 4000);
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
