import { GAME_CONFIG } from './config.js';
import { gameState, bestLocalScore } from './state.js';
import { playSound } from './audio.js';
import { showNewsTicker, flash } from './effects.js';
import { isFeedbackSuspended } from './feedback.js';
import { getSettings } from './settings.js';
import { saveBestScore } from './save.js';

let trophyElements = null;

function getTrophyElements() {
    if (!trophyElements) {
        trophyElements = {
            bronze: document.getElementById('trophyBronzeIcon'),
            silver: document.getElementById('trophySilverIcon'),
            gold: document.getElementById('trophyGoldIcon'),
        };
    }
    return trophyElements;
}

const TROPHIES = [
    {
        key: 'trophyBronze', tier: 'bronze', threshold: GAME_CONFIG.TROPHY_BRONZE_THRESHOLD,
        message: '🏆 إنجاز جديد: البرونزي (1,000 مشبك مُباع)!', emoji: '🌟',
    },
    {
        key: 'trophySilver', tier: 'silver', threshold: GAME_CONFIG.TROPHY_SILVER_THRESHOLD,
        message: '🏆 إنجاز جديد: الفضي (10,000 مشبك مُباع)!', emoji: '✨',
    },
    {
        key: 'trophyGold', tier: 'gold', threshold: GAME_CONFIG.TROPHY_GOLD_THRESHOLD,
        message: '🏆 إنجاز جديد: الذهبي (100,000 مشبك مُباع)! تهانينا!', emoji: '🌟',
    },
];

// Awarding is logic; drawing is DOM. They used to be one function that wiped
// and re-applied the trophy classes on <body> after every sale — every two
// seconds under auto-sell, and 14,400 times inside an eight-hour offline
// replay. Now the DOM is touched only when a trophy is actually won, or when
// a caller asks for a redraw (load, new run, import, reduce-flash toggle).
//
// `lifetimeSold` is the yardstick, not the current run's `totalSold`: a
// trophy is a lifetime award and must survive a prestige reset.
export function checkTrophy(lifetimeSold) {
    let awarded = false;
    for (const trophy of TROPHIES) {
        if (gameState[trophy.key] || lifetimeSold < trophy.threshold) continue;
        gameState[trophy.key] = true;
        awarded = true;
        playSound('trophy');
        showNewsTicker(trophy.message, trophy.emoji);
    }
    // During an offline replay the caller redraws once afterwards.
    if (awarded && !isFeedbackSuspended()) renderTrophies();
    return awarded;
}

// Shows only the highest trophy won. The aura is a large permanent glow;
// light-sensitive players can switch it off independently of
// prefers-reduced-motion, which does not cover it (it is not an animation).
export function renderTrophies() {
    const elements = getTrophyElements();
    const { reduceFlash } = getSettings();
    let highest = null;
    for (const trophy of TROPHIES) {
        if (gameState[trophy.key]) highest = trophy.tier;
    }
    document.body.classList.remove('trophy-bronze', 'trophy-silver', 'trophy-gold');
    for (const trophy of TROPHIES) {
        const el = elements[trophy.tier];
        if (el) el.style.display = trophy.tier === highest ? 'flex' : 'none';
    }
    if (highest && !reduceFlash) document.body.classList.add(`trophy-${highest}`);
}

// ---- Achievement tree ----------------------------------------------------
// Data-driven so the list is one array to extend. These are the long tail of
// goals that used to be missing entirely: after the gold trophy the game had
// nothing left to ask of the player.

export const ACHIEVEMENTS = [
    { id: 'first-clip', icon: '📎', title: 'أول مشبك', desc: 'اصنع أول مشبك ورقي', test: (s) => s.totalClips >= 1 },
    { id: 'first-sale', icon: '💵', title: 'أول بيعة', desc: 'بِع أول مشبك', test: (s) => s.totalSold >= 1 },
    { id: 'first-machine', icon: '🤖', title: 'الأتمتة تبدأ', desc: 'اشترِ أول آلة صنع تلقائي', test: (s) => s.autoClippers >= 1 },
    { id: 'ten-machines', icon: '⚙️', title: 'خط إنتاج', desc: 'امتلك 10 آلات', test: (s) => s.autoClippers >= 10 },
    { id: 'full-floor', icon: '🏭', title: 'أرضية ممتلئة', desc: 'امتلك 100 آلة', test: (s) => s.autoClippers >= 100 },
    { id: 'thousand-clips', icon: '📦', title: 'إنتاج ضخم', desc: 'أنتج 100,000 مشبك', test: (s) => s.totalClips >= 100000 },
    { id: 'rich', icon: '💰', title: 'رأس مال', desc: 'اجمع $10,000', test: (s) => s.money >= 10000 },
    { id: 'tycoon', icon: '🏦', title: 'قطب صناعي', desc: 'اجمع $1,000,000', test: (s) => s.money >= 1000000 },
    { id: 'marketer', icon: '📣', title: 'حملة كبرى', desc: 'ارفع التسويق للمستوى 10', test: (s) => s.marketingLevel >= 10 },
    { id: 'efficient', icon: '🧵', title: 'سلك ذكي', desc: 'ارفع كفاءة السلك إلى ×5', test: (s) => s.wireEfficiency >= 5 },
    { id: 'warehouse', icon: '🏗️', title: 'مستودع عملاق', desc: 'وسّع المستودع إلى 50,000', test: (s) => s.maxClipsLimit >= 50000 },
    { id: 'insured', icon: '🛡️', title: 'إدارة مخاطر', desc: 'اشترِ التأمين لأول مرة', test: (s) => s.insuranceLevel >= 1 },
    { id: 'prestige-1', icon: '⭐', title: 'بداية جديدة', desc: 'أعد التأسيس لأول مرة', test: (s) => s.prestigeResets >= 1 },
    { id: 'prestige-5', icon: '🌟', title: 'إمبراطورية', desc: 'أعد التأسيس 5 مرات', test: (s) => s.prestigeResets >= 5 },
];

export function isAchievementUnlocked(id) {
    return gameState.unlockedAchievements.includes(id);
}

// Returns the achievements unlocked by this call, so the caller decides how
// loudly to announce them.
export function checkAchievements() {
    const unlocked = [];
    for (const achievement of ACHIEVEMENTS) {
        if (isAchievementUnlocked(achievement.id)) continue;
        if (!achievement.test(gameState)) continue;
        gameState.unlockedAchievements.push(achievement.id);
        unlocked.push(achievement);
    }
    if (unlocked.length && !isFeedbackSuspended()) {
        const first = unlocked[0];
        const extra = unlocked.length > 1 ? ` (+${unlocked.length - 1})` : '';
        showNewsTicker(`${first.icon} إنجاز: ${first.title}${extra}`, '🏅', 3500);
        playSound('completion');
    }
    return unlocked;
}

// The best score updates on ANY new record so the leaderboard never lies;
// the celebration (ticker + sound) only fires every RECORD_THRESHOLD clips
// to avoid notification spam.
let lastCelebratedSold = null;

export function resetRecordTracking() {
    lastCelebratedSold = null;
}

export function checkLocalRecord() {
    const previousBest = bestLocalScore.totalSold || 0;
    if (lastCelebratedSold === null) lastCelebratedSold = previousBest;
    if (gameState.totalSold <= previousBest) return;

    bestLocalScore.totalSold = gameState.totalSold;
    bestLocalScore.money = parseFloat(gameState.money.toFixed(2));
    bestLocalScore.date = new Date().toISOString();

    if (gameState.totalSold >= lastCelebratedSold + GAME_CONFIG.RECORD_THRESHOLD) {
        lastCelebratedSold = gameState.totalSold;
        saveBestScore();
        showNewsTicker('🎉 رقم قياسي جديد! تم تحطيم أفضل مبيعاتك السابقة!', '🏅', 3500);
        playSound('completion');
        flash('card-clips');
        flash('card-money');
    }
}
