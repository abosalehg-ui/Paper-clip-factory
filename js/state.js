import { GAME_CONFIG } from './config.js';
import { effectiveDemandCap, maxPrice, computeWireCost } from './economy.js';

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

        // Prestige progress survives a factory reset; `lifetimeSold` is the
        // running total across every reset and is what awards points.
        prestigePoints: 0,
        prestigeResets: 0,
        lifetimeSold: 0,

        unlockedAchievements: [],
        onboardingStep: 0,

        lastSaveTime: Date.now(),
        // Monotonic play time, advanced from performance.now() deltas. Used to
        // sanity-check wall-clock gaps so winding the system clock forward
        // cannot mint offline progress.
        playTimeMs: 0,
    };
}

export const gameState = createDefaultGameState();

export const bestLocalScore = {
    totalSold: 0,
    money: 0,
    date: null,
};

// Declarative validation for every numeric field a save file may carry.
// A value must be a finite number (NaN/Infinity/strings are rejected and the
// default kept); it is then clamped into [min, max] and floored if integer.
// This is the single source of truth for save integrity — extend it whenever
// a numeric field is added to the state.
const BIG = 1e15; // below Number.MAX_SAFE_INTEGER, far above any legit value
const SAVE_FIELD_RULES = {
    clips: { min: 0, max: BIG, integer: true },
    money: { min: 0, max: BIG },
    // The live ceiling is marketing-dependent and enforced in the cross-field
    // pass below; this is just a sanity bound.
    price: { min: GAME_CONFIG.MIN_PRICE, max: 1e6 },
    demand: { min: 1, max: 1e9, integer: true },
    wire: { min: 0, max: BIG, integer: true },
    wireCost: { min: 1, max: 1e9 },
    autoClippers: { min: 0, max: 1e6, integer: true },
    autoClipperCost: { min: GAME_CONFIG.INITIAL_AUTO_CLIPPER_COST, max: BIG },
    autoClipperRate: { min: 0, max: 1e9, integer: true },
    wireEfficiency: { min: 1, max: 1e4 },
    marketingLevel: { min: 1, max: 1e5, integer: true },
    totalClips: { min: 0, max: BIG, integer: true },
    totalSold: { min: 0, max: BIG, integer: true },
    insuranceLevel: { min: 0, max: 1e5, integer: true },
    insuranceCost: { min: GAME_CONFIG.INSURANCE_BASE_COST, max: BIG },
    insuranceEndTime: { min: 0, max: () => Date.now() + GAME_CONFIG.MAX_INSURANCE_FUTURE_MS },
    maxClippersLimit: { min: GAME_CONFIG.INITIAL_MAX_CLIPPERS, max: 1e7, integer: true },
    expansionCost: { min: GAME_CONFIG.INITIAL_EXPANSION_COST, max: BIG },
    maxClipsLimit: { min: GAME_CONFIG.INITIAL_MAX_CLIPS, max: BIG, integer: true },
    warehouseCost: { min: GAME_CONFIG.INITIAL_WAREHOUSE_COST, max: BIG },
    prestigePoints: { min: 0, max: 1e6, integer: true },
    prestigeResets: { min: 0, max: 1e6, integer: true },
    lifetimeSold: { min: 0, max: BIG, integer: true },
    onboardingStep: { min: 0, max: 100, integer: true },
    lastSaveTime: { min: 0, max: () => Date.now() },
    playTimeMs: { min: 0, max: BIG },
};

export function applySavedState(saved) {
    if (!saved || typeof saved !== 'object') return;
    const defaults = createDefaultGameState();
    for (const key of Object.keys(defaults)) {
        const value = saved[key];
        const rules = SAVE_FIELD_RULES[key];
        if (rules) {
            if (!Number.isFinite(value)) continue;
            const max = typeof rules.max === 'function' ? rules.max() : rules.max;
            let v = Math.min(max, Math.max(rules.min, value));
            if (rules.integer) v = Math.floor(v);
            gameState[key] = v;
        } else if (Array.isArray(defaults[key])) {
            // Arrays carry ids, not numbers: keep strings only, and cap the
            // length so a hand-edited save cannot blow up memory.
            gameState[key] = Array.isArray(value)
                ? value.filter((item) => typeof item === 'string').slice(0, 200)
                : [];
        } else if (typeof value === typeof defaults[key] && value !== null) {
            gameState[key] = value;
        }
    }

    // ---- Cross-field consistency ----------------------------------------
    // Inventories can never exceed their limits.
    gameState.clips = Math.min(gameState.clips, gameState.maxClipsLimit);
    gameState.autoClippers = Math.min(gameState.autoClippers, gameState.maxClippersLimit);
    // Price is bounded by the demand curve the current marketing level
    // supports — this is what stops an edited save from re-introducing the
    // unbounded-price economy.
    gameState.price = Math.min(gameState.price, maxPrice(gameState.marketingLevel));
    gameState.price = Math.max(GAME_CONFIG.MIN_PRICE, gameState.price);
    // Demand cannot exceed what that price supports.
    gameState.demand = Math.min(
        gameState.demand,
        effectiveDemandCap(gameState.marketingLevel, gameState.price),
    );
    // Derived prices are recomputed rather than trusted.
    gameState.wireCost = computeWireCost(gameState.totalClips);
    // Lifetime sales can never be behind the current run.
    gameState.lifetimeSold = Math.max(gameState.lifetimeSold, gameState.totalSold);
}

export function applyBestScore(saved) {
    if (!saved || typeof saved !== 'object') return;
    bestLocalScore.totalSold = Number.isFinite(saved.totalSold) ? Math.max(0, saved.totalSold) : 0;
    bestLocalScore.money = Number.isFinite(saved.money) ? Math.max(0, saved.money) : 0;
    bestLocalScore.date = saved.date || null;
}

export function resetBestLocalScore() {
    bestLocalScore.totalSold = 0;
    bestLocalScore.money = 0;
    bestLocalScore.date = null;
}
