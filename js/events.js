import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import { effectiveDemandCap, computeAutoClipperCost } from './economy.js';
import { playSound } from './audio.js';
import { flash, showNewsTicker } from './effects.js';
import { isInsuranceActive } from './upgrades.js';

// Insurance no longer cancels events outright — one purchase used to switch
// the entire challenge system off forever. It now blunts the damage instead,
// which keeps it worth buying without erasing the risk.
function applyInsurance(amount) {
    if (!isInsuranceActive()) return amount;
    return amount * (1 - GAME_CONFIG.INSURANCE_DAMAGE_REDUCTION);
}

// Damage is a fraction of what the player owns, so events keep their sting in
// a late-game economy instead of fading into rounding noise.
const EVENT_TYPES = {
    money: {
        eligible: (s) => s.money >= GAME_CONFIG.MIN_EVENT_MONEY,
        run(s) {
            const raw = Math.max(
                GAME_CONFIG.THEFT_MIN_AMOUNT,
                s.money * GAME_CONFIG.THEFT_WEALTH_FRACTION,
            );
            const loss = Math.min(s.money, applyInsurance(raw));
            s.money = Math.max(0, s.money - loss);
            showNewsTicker(`⚠️ حادث: سرقة! سُرق $${loss.toFixed(2)} من أموالك.`, '🚨', 4500);
            playSound('warning');
            flash('card-money');
        },
    },
    clips: {
        eligible: (s) => s.clips >= GAME_CONFIG.MIN_EVENT_CLIPS,
        run(s) {
            const raw = Math.max(
                GAME_CONFIG.FIRE_MIN_CLIP_LOSS,
                s.clips * GAME_CONFIG.FIRE_CLIP_FRACTION,
            );
            const loss = Math.min(s.clips, Math.floor(applyInsurance(raw)));
            s.clips = Math.max(0, s.clips - loss);
            showNewsTicker(`🔥 حادث: حريق! تلف ${loss.toLocaleString()} مشبك ورقي.`, '🚒', 4500);
            playSound('fire');
            flash('card-clips');
        },
    },
    clippers: {
        eligible: (s) => s.autoClippers >= GAME_CONFIG.MIN_EVENT_CLIPPERS,
        run(s) {
            // Proportional loss; the machine price de-escalates with the count
            // so replacing destroyed machines is painful but never ruinous.
            const raw = Math.max(1, s.autoClippers * GAME_CONFIG.CLIPPER_LOSS_FRACTION);
            const loss = Math.min(s.autoClippers, Math.max(1, Math.floor(applyInsurance(raw))));
            s.autoClippers = Math.max(0, s.autoClippers - loss);
            s.autoClipperCost = computeAutoClipperCost(s.autoClippers);
            showNewsTicker(`⚙️ حادث: تلف آلات! تعطلت ${loss} آلة صنع تلقائي.`, '💥', 4500);
            playSound('fire');
        },
    },
    demand: {
        eligible: (s) => s.demand >= GAME_CONFIG.MIN_EVENT_DEMAND,
        run(s) {
            const oldDemand = s.demand;
            const drop = applyInsurance(oldDemand * (1 - GAME_CONFIG.NEGATIVE_PR_DEMAND_FACTOR));
            const cap = effectiveDemandCap(s.marketingLevel, s.price);
            s.demand = Math.max(1, Math.min(cap, Math.floor(oldDemand - drop)));
            showNewsTicker(`📉 تحدي: دعاية سلبية! انخفض الطلب من ${oldDemand} إلى ${s.demand}.`, '📢', 4500);
            playSound('warning');
            flash('card-demand');
        },
    },
};

// `rng` is injectable so the event system is testable without stubbing globals.
export function triggerRandomChallenge(rng = Math.random) {
    if (rng() >= GAME_CONFIG.EVENT_BASE_CHANCE) return false;

    // Every eligible category gets an equal shot. The old nested-threshold
    // chain let the first eligible type eat the roll, and the absolute
    // thresholds meant a player could dodge all events for free by staying
    // under them.
    const candidates = Object.keys(EVENT_TYPES).filter((id) => EVENT_TYPES[id].eligible(gameState));
    if (!candidates.length) return false;

    const picked = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
    EVENT_TYPES[picked].run(gameState);
    return picked;
}
