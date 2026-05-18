import { GAME_CONFIG } from './config.js';

export function createDefaultGameState() {
    return {
        clips: 0,
        money: 0,
        price: GAME_CONFIG.INITIAL_PRICE,
        demand: GAME_CONFIG.INITIAL_DEMAND,
        wire: GAME_CONFIG.INITIAL_WIRE,
        wireCost: GAME_CONFIG.INITIAL_WIRE_COST,
        autoClippers: 0,
        autoClipperCost: GAME_CONFIG.INITIAL_AUTO_CLIPPER_COST,
        autoClipperRate: 0,
        wireEfficiency: 1,
        marketingLevel: 1,
        autoSellEnabled: false,
        totalClips: 0,
        totalSold: 0,

        insuranceLevel: 0,
        insuranceCost: GAME_CONFIG.INSURANCE_BASE_COST,
        insuranceEndTime: 0,

        maxClippersLimit: GAME_CONFIG.INITIAL_MAX_CLIPPERS,
        expansionCost: GAME_CONFIG.INITIAL_EXPANSION_COST,

        maxClipsLimit: GAME_CONFIG.INITIAL_MAX_CLIPS,
        warehouseCost: GAME_CONFIG.INITIAL_WAREHOUSE_COST,

        trophyBronze: false,
        trophySilver: false,
        trophyGold: false,

        lastSaveTime: Date.now(),
        gameOver: false,
    };
}

export const gameState = createDefaultGameState();

export const bestLocalScore = {
    totalSold: 0,
    money: 0,
    date: null,
};

export function applySavedState(saved) {
    if (!saved || typeof saved !== 'object') return;
    const defaults = createDefaultGameState();
    for (const key of Object.keys(defaults)) {
        if (typeof saved[key] === typeof defaults[key] && saved[key] !== null) {
            gameState[key] = saved[key];
        }
    }
    if (typeof gameState.money !== 'number' || isNaN(gameState.money) || gameState.money < 0) {
        gameState.money = 0;
    }
    if (typeof gameState.clips !== 'number' || isNaN(gameState.clips) || gameState.clips < 0) {
        gameState.clips = 0;
    }
    if (typeof gameState.wire !== 'number' || isNaN(gameState.wire) || gameState.wire < 0) {
        gameState.wire = 0;
    }
}

export function applyBestScore(saved) {
    if (!saved || typeof saved !== 'object') return;
    bestLocalScore.totalSold = saved.totalSold || 0;
    bestLocalScore.money = saved.money || 0;
    bestLocalScore.date = saved.date || null;
}

export function resetBestLocalScore() {
    bestLocalScore.totalSold = 0;
    bestLocalScore.money = 0;
    bestLocalScore.date = null;
}
