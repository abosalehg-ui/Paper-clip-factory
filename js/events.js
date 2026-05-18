import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import { playSound } from './audio.js';
import { flash, showNewsTicker } from './effects.js';
import { isInsuranceActive } from './upgrades.js';

export function triggerRandomChallenge() {
    if (isInsuranceActive()) return false;
    if (Math.random() >= GAME_CONFIG.EVENT_BASE_CHANCE) return false;

    let challengeType = null;
    if (gameState.money >= GAME_CONFIG.MONEY_THRESHOLD_FOR_THEFT && Math.random() < GAME_CONFIG.EVENT_SUB_CHANCE) {
        challengeType = 'money';
    } else if (gameState.clips >= GAME_CONFIG.CLIPS_THRESHOLD_FOR_FIRE && Math.random() < GAME_CONFIG.EVENT_SUB_CHANCE) {
        challengeType = 'clips';
    } else if (gameState.autoClippers >= GAME_CONFIG.CLIPPERS_THRESHOLD_FOR_DAMAGE && Math.random() < GAME_CONFIG.EVENT_SUB_CHANCE) {
        challengeType = 'clippers';
    } else if (gameState.demand >= GAME_CONFIG.DEMAND_THRESHOLD_FOR_NEGATIVE_PR && Math.random() < GAME_CONFIG.EVENT_SUB_CHANCE) {
        challengeType = 'demand';
    }

    if (!challengeType) return false;

    if (challengeType === 'money') {
        const loss = GAME_CONFIG.THEFT_AMOUNT;
        gameState.money = Math.max(0, gameState.money - loss);
        showNewsTicker(`⚠️ حادث: سرقة! سُرق $${loss.toFixed(2)} من أموالك.`, '🚨', 4500);
        playSound('warning');
        flash('card-money');
    } else if (challengeType === 'clips') {
        const loss = GAME_CONFIG.FIRE_CLIP_LOSS;
        gameState.clips = Math.max(0, gameState.clips - loss);
        showNewsTicker(`🔥 حادث: حريق! تلف ${loss.toLocaleString()} مشبك ورقي.`, '🚒', 4500);
        playSound('fire');
        flash('card-clips');
    } else if (challengeType === 'clippers') {
        const loss = GAME_CONFIG.CLIPPER_LOSS;
        gameState.autoClippers = Math.max(0, gameState.autoClippers - loss);
        showNewsTicker(`⚙️ حادث: تلف آلات! تعطلت ${loss} آلة صنع تلقائي.`, '💥', 4500);
        playSound('fire');
    } else if (challengeType === 'demand') {
        const oldDemand = gameState.demand;
        gameState.demand = 1;
        showNewsTicker(`📉 تحدي: دعاية سلبية! انخفض الطلب من ${oldDemand} إلى ${gameState.demand}.`, '📢', 4500);
        playSound('warning');
        flash('card-demand');
    }
    return true;
}
