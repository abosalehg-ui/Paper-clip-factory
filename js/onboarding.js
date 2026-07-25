import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import { pendingPrestigePoints } from './economy.js';

// Progressive onboarding, replacing the wall of text that used to open on
// first launch: fifteen bullet points covering every mechanic before the
// player had seen a single button.
//
// One instruction at a time, each unlocked by actually doing the previous
// one. The full guide still exists behind the "?" button for reference.

export const ONBOARDING_STEPS = [
    {
        id: 'make',
        hint: 'اصنع 10 مشابك للبدء — كل مشبك يستهلك وحدة سلك.',
        highlight: 'makeBtn',
        target: 10,
        progress: (s) => Math.min(10, s.totalClips),
        done: (s) => s.totalClips >= 10,
    },
    {
        id: 'sell',
        hint: 'ممتاز! الآن بِع مشابكك لتحصل على أول مال.',
        highlight: 'sellBtn',
        target: 1,
        progress: (s) => Math.min(1, s.totalSold),
        done: (s) => s.totalSold >= 1,
    },
    {
        id: 'machine',
        hint: 'اجمع $5 واشترِ أول آلة — ستصنع المشابك بدلاً عنك.',
        highlight: 'autoClipperBtn',
        target: 1,
        progress: (s) => Math.min(1, s.autoClippers),
        done: (s) => s.autoClippers >= 1,
    },
    {
        id: 'autosell',
        hint: 'أخيراً: فعّل «البيع التلقائي» ودع المصنع يعمل وحده.',
        highlight: 'autoSellBtn',
        target: 1,
        progress: (s) => (s.autoSellEnabled ? 1 : 0),
        done: (s) => s.autoSellEnabled,
    },
];

export function isOnboardingComplete() {
    return gameState.onboardingStep >= ONBOARDING_STEPS.length;
}

// Advances past every step whose goal is already met (so importing a mature
// save does not walk the player back through the tutorial) and returns the
// step to display, or null when finished.
export function updateOnboarding() {
    while (
        gameState.onboardingStep < ONBOARDING_STEPS.length &&
        ONBOARDING_STEPS[gameState.onboardingStep].done(gameState)
    ) {
        gameState.onboardingStep++;
    }
    if (isOnboardingComplete()) return null;
    return ONBOARDING_STEPS[gameState.onboardingStep];
}

// The always-visible objective once the tutorial is done. The trophy
// thresholds existed but were never shown, so the player had no stated goal
// at any point.
const GOALS = [
    { label: '🥉 الجائزة البرونزية', target: GAME_CONFIG.TROPHY_BRONZE_THRESHOLD },
    { label: '🥈 الجائزة الفضية', target: GAME_CONFIG.TROPHY_SILVER_THRESHOLD },
    { label: '🥇 الجائزة الذهبية', target: GAME_CONFIG.TROPHY_GOLD_THRESHOLD },
];

export function getNextGoal() {
    for (const goal of GOALS) {
        if (gameState.totalSold < goal.target) {
            return { label: goal.label, current: gameState.totalSold, target: goal.target };
        }
    }
    // Past the trophies the objective becomes the next prestige point.
    const banked = gameState.prestigePoints + pendingPrestigePoints(
        gameState.lifetimeSold, gameState.prestigePoints,
    );
    const target = (banked + 1) * GAME_CONFIG.PRESTIGE_REQUIREMENT;
    return {
        label: '⭐ نقطة إعادة تأسيس',
        current: gameState.lifetimeSold,
        target,
    };
}
