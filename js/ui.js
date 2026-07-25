import { GAME_CONFIG, DEFAULT_KEY_BINDINGS } from './config.js';
import { gameState, bestLocalScore } from './state.js';
import { getUpgradeCost } from './upgrades.js';
import { formatNumber, formatMoney } from './format.js';
import { reduceMotion } from './effects.js';
import {
    effectiveDemandCap, optimalPrice, chokePrice, maxPrice,
} from './economy.js';
import { ACHIEVEMENTS, isAchievementUnlocked } from './achievements.js';
import { updateOnboarding, getNextGoal } from './onboarding.js';
import { pendingPoints, canPrestige, currentMultiplier } from './prestige.js';
import { getSettings, describeKey } from './settings.js';

const els = {};

// Dirty-check writes: skip DOM mutations when the rendered value is unchanged.
// This keeps the throttled render loop cheap and avoids needless reflows.
function setText(el, value) {
    if (!el) return;
    const str = String(value);
    if (el._txt !== str) {
        el.textContent = str;
        el._txt = str;
    }
}

// Optional `reason` renders as a tooltip explaining WHY the button is
// disabled ("not enough money", "at machine cap", ...).
function setDisabled(el, disabled, reason = '') {
    if (!el) return;
    disabled = !!disabled;
    if (el.disabled !== disabled) {
        el.disabled = disabled;
        el.setAttribute('aria-disabled', String(disabled));
    }
    const title = disabled ? reason : '';
    if (el._title !== title) {
        el._title = title;
        if (title) el.setAttribute('title', title);
        else el.removeAttribute('title');
    }
}

function setHidden(el, hidden) {
    if (!el) return;
    if (el.hidden !== hidden) el.hidden = hidden;
}

function setWidth(el, percent) {
    if (!el) return;
    const value = `${Math.max(0, Math.min(100, percent)).toFixed(1)}%`;
    if (el._w !== value) {
        el._w = value;
        el.style.width = value;
    }
}

const REASON_NO_MONEY = 'مال غير كافٍ';

export function initUI() {
    const ids = [
        'clips', 'clipsLimitCurrent', 'money', 'wire', 'demand', 'demandCap',
        'autoClippers', 'autoClipperCost', 'wireCost', 'wireEfficiency',
        'wireEfficiencyInline', 'efficiencyCost', 'marketingLevel',
        'marketingCost', 'availableClips', 'totalClips', 'totalSold',
        'totalMachines', 'productionRate', 'insuranceLevel', 'insuranceCost',
        'maxClippers', 'expansionCost', 'warehouseCost', 'price', 'makeBtn',
        'makeBtnText', 'sellBtn', 'autoClipperBtn', 'wireBtn', 'efficiencyBtn',
        'marketingBtn', 'expansionBtn', 'warehouseBtn', 'insuranceBtn',
        'insuranceTimer', 'autoSellBtn', 'autoSellState', 'bestTotalSold',
        'bestMoney', 'bestDate', 'decreasePriceBtn', 'increasePriceBtn',
        'gameOverMoney', 'gameOverSold', 'gameOverBest',
        'priceOptimal', 'priceChoke', 'priceRevenue',
        'onboardingBanner', 'onboardingHint', 'onboardingCount', 'onboardingFill',
        'goalBanner', 'goalLabel', 'goalCount', 'goalFill',
        'prestigeSection', 'prestigeMultiplier', 'prestigePoints',
        'prestigeResets', 'lifetimeSold', 'prestigePending', 'prestigeBtn',
        'achievementsList', 'achievementsCount', 'achievementsTotal',
        'soundToggleBtn', 'volumeSlider', 'volumeValue', 'reduceFlashBtn',
        'keybindMake', 'keybindSell', 'keybindWire', 'keybindMachine',
        'shortcutsHint', 'guideShortcuts', 'rebindNote',
    ];
    for (const id of ids) {
        els[id] = document.getElementById(id);
    }
}

export function updateInsuranceTimer() {
    if (!els.insuranceTimer || !els.insuranceBtn) return;
    const remaining = gameState.insuranceEndTime - Date.now();
    if (remaining > 0) {
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        setText(els.insuranceTimer,
            `التأمين نشط: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        els.insuranceTimer.style.display = 'block';
    } else {
        gameState.insuranceEndTime = 0;
        setText(els.insuranceTimer, '');
        els.insuranceTimer.style.display = 'none';
    }
}

// The money readout eases toward the real value so gains "count up" instead
// of jumping — a cheap but effective game-feel win. Skipped under
// prefers-reduced-motion.
let displayedMoney = null;

export function snapMoneyDisplay() {
    displayedMoney = gameState.money;
}

function easedMoney() {
    if (
        reduceMotion ||
        displayedMoney === null ||
        Math.abs(displayedMoney - gameState.money) < 0.01
    ) {
        displayedMoney = gameState.money;
    } else {
        displayedMoney += (gameState.money - displayedMoney) * 0.35;
    }
    return displayedMoney;
}

// ---- Objective bars ------------------------------------------------------

function renderObjectives() {
    const step = updateOnboarding();
    if (step) {
        setHidden(els.onboardingBanner, false);
        setHidden(els.goalBanner, true);
        const current = step.progress(gameState);
        setText(els.onboardingHint, step.hint);
        setText(els.onboardingCount, `${formatNumber(current)}/${formatNumber(step.target)}`);
        setWidth(els.onboardingFill, (current / step.target) * 100);
        return;
    }

    setHidden(els.onboardingBanner, true);
    const goal = getNextGoal();
    setHidden(els.goalBanner, false);
    setText(els.goalLabel, goal.label);
    setText(els.goalCount, `${formatNumber(goal.current)}/${formatNumber(goal.target)}`);
    setWidth(els.goalFill, (goal.current / goal.target) * 100);
}

// ---- Main render ---------------------------------------------------------

export function updateUI() {
    if (!els.clips) return;

    const efficiencyCost = getUpgradeCost('efficiency');
    const marketingCost = getUpgradeCost('marketing');
    const insuranceCost = getUpgradeCost('insurance');
    const demandCap = effectiveDemandCap(gameState.marketingLevel, gameState.price);

    setText(els.clips, formatNumber(gameState.clips));
    setText(els.money, formatMoney(easedMoney()));
    setText(els.wire, formatNumber(gameState.wire));
    setText(els.demand, formatNumber(gameState.demand));
    setText(els.demandCap, formatNumber(demandCap));

    if (document.activeElement !== els.price) {
        setText(els.price, gameState.price.toFixed(2));
    }

    // Pricing guidance: the demand curve is a real trade-off now, so its shape
    // is surfaced instead of left to be reverse-engineered.
    setText(els.priceOptimal, optimalPrice(gameState.marketingLevel).toFixed(2));
    setText(els.priceChoke, chokePrice(gameState.marketingLevel).toFixed(2));
    setText(els.priceRevenue, formatMoney(gameState.price * demandCap));

    setText(els.autoClippers, formatNumber(gameState.autoClippers));
    setText(els.autoClipperCost, formatMoney(gameState.autoClipperCost));
    setText(els.wireCost, formatMoney(gameState.wireCost));
    setText(els.wireEfficiency, gameState.wireEfficiency.toFixed(1));
    setText(els.wireEfficiencyInline, gameState.wireEfficiency.toFixed(1));
    setText(els.efficiencyCost, formatMoney(efficiencyCost));
    setText(els.marketingLevel, formatNumber(gameState.marketingLevel));
    setText(els.marketingCost, formatMoney(marketingCost));
    setText(els.availableClips, formatNumber(gameState.clips));
    setText(els.totalClips, formatNumber(gameState.totalClips));
    setText(els.totalSold, formatNumber(gameState.totalSold));
    setText(els.totalMachines, formatNumber(gameState.autoClippers));
    setText(els.productionRate, formatNumber(gameState.autoClipperRate));

    setText(els.insuranceLevel, formatNumber(gameState.insuranceLevel));
    setText(els.insuranceCost, formatMoney(insuranceCost));

    setText(els.maxClippers, formatNumber(gameState.maxClippersLimit));
    setText(els.expansionCost, formatMoney(gameState.expansionCost));

    setText(els.clipsLimitCurrent, formatNumber(gameState.maxClipsLimit));
    setText(els.warehouseCost, formatMoney(gameState.warehouseCost));

    updateInsuranceTimer();

    const warehouseFull = gameState.clips >= gameState.maxClipsLimit;
    const noWire = gameState.wire < 1;
    setDisabled(els.makeBtn, noWire || warehouseFull);
    setText(els.makeBtnText, noWire
        ? 'لا يوجد سلك'
        : warehouseFull ? 'المستودع ممتلئ' : 'صنع مشبك');

    setDisabled(els.sellBtn, gameState.clips === 0, 'لا توجد مشابك للبيع');
    const clippersMaxed = gameState.autoClippers >= gameState.maxClippersLimit;
    setDisabled(els.autoClipperBtn,
        gameState.money < gameState.autoClipperCost || clippersMaxed,
        clippersMaxed ? 'وصلت للحد الأقصى — اشترِ توسعة المصنع' : REASON_NO_MONEY);
    setDisabled(els.wireBtn, gameState.money < gameState.wireCost, REASON_NO_MONEY);
    setDisabled(els.efficiencyBtn, gameState.money < efficiencyCost, REASON_NO_MONEY);
    setDisabled(els.marketingBtn, gameState.money < marketingCost, REASON_NO_MONEY);
    setDisabled(els.expansionBtn, gameState.money < gameState.expansionCost, REASON_NO_MONEY);
    setDisabled(els.warehouseBtn, gameState.money < gameState.warehouseCost, REASON_NO_MONEY);
    setDisabled(els.insuranceBtn, gameState.money < insuranceCost, REASON_NO_MONEY);

    // Price buttons stop at the edges of the demand curve.
    setDisabled(els.increasePriceBtn,
        gameState.price >= maxPrice(gameState.marketingLevel),
        'عند سعر التوقف لا يشتري أحد — ارفع التسويق أولاً');
    setDisabled(els.decreasePriceBtn, gameState.price <= GAME_CONFIG.MIN_PRICE, 'أدنى سعر ممكن');

    setText(els.bestTotalSold, formatNumber(bestLocalScore.totalSold));
    setText(els.bestMoney, formatMoney(bestLocalScore.money || 0));
    setText(els.bestDate, bestLocalScore.date
        ? new Date(bestLocalScore.date).toLocaleString()
        : '—');

    // Prestige
    setText(els.prestigeMultiplier, currentMultiplier().toFixed(2));
    setText(els.prestigePoints, formatNumber(gameState.prestigePoints));
    setText(els.prestigeResets, formatNumber(gameState.prestigeResets));
    setText(els.lifetimeSold, formatNumber(gameState.lifetimeSold));
    setText(els.prestigePending, formatNumber(pendingPoints()));
    setDisabled(els.prestigeBtn, !canPrestige(),
        `تحتاج ${formatNumber(GAME_CONFIG.PRESTIGE_REQUIREMENT)} مشبك مُباع (مدى الحياة) لكل نقطة`);
    // The panel only appears once it can mean something.
    setHidden(els.prestigeSection,
        gameState.prestigeResets === 0 && gameState.lifetimeSold < GAME_CONFIG.PRESTIGE_REQUIREMENT / 10);

    renderObjectives();
}

export function updateAutoSellToggle() {
    if (!els.autoSellBtn) return;
    els.autoSellBtn.className = gameState.autoSellEnabled
        ? 'toggle-btn toggle-on'
        : 'toggle-btn toggle-off';
    els.autoSellBtn.setAttribute('aria-pressed', String(gameState.autoSellEnabled));
    // Spelled out as well as coloured, so the state does not depend on
    // distinguishing green from grey.
    setText(els.autoSellState, gameState.autoSellEnabled ? 'مفعّل' : 'معطّل');
}

// ---- Achievements --------------------------------------------------------

export function renderAchievements() {
    if (!els.achievementsList) return;
    const unlockedCount = ACHIEVEMENTS.filter((a) => isAchievementUnlocked(a.id)).length;
    setText(els.achievementsCount, formatNumber(unlockedCount));
    setText(els.achievementsTotal, formatNumber(ACHIEVEMENTS.length));

    els.achievementsList.textContent = '';
    for (const achievement of ACHIEVEMENTS) {
        const unlocked = isAchievementUnlocked(achievement.id);
        const row = document.createElement('div');
        row.className = unlocked ? 'achievement unlocked' : 'achievement';

        const icon = document.createElement('span');
        icon.className = 'achievement-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = unlocked ? achievement.icon : '🔒';

        const body = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'achievement-title';
        title.textContent = achievement.title;
        const desc = document.createElement('div');
        desc.className = 'achievement-desc';
        desc.textContent = achievement.desc;
        body.append(title, desc);

        row.append(icon, body);
        els.achievementsList.appendChild(row);
    }
}

// ---- Settings ------------------------------------------------------------

const BIND_ELEMENTS = {
    make: 'keybindMake',
    sell: 'keybindSell',
    wire: 'keybindWire',
    machine: 'keybindMachine',
};

const BIND_LABELS = {
    make: 'صنع',
    sell: 'بيع',
    wire: 'شراء سلك',
    machine: 'شراء آلة',
};

export function renderSettings() {
    const { soundEnabled, volume, reduceFlash, keyBindings } = getSettings();

    setText(els.soundToggleBtn, soundEnabled ? '🔊 مفعّل' : '🔇 مكتوم');
    setText(els.reduceFlashBtn, reduceFlash ? 'مفعّل' : 'معطّل');
    setText(els.volumeValue, `${Math.round(volume * 100)}%`);
    if (els.volumeSlider) {
        const value = String(Math.round(volume * 100));
        if (els.volumeSlider.value !== value) els.volumeSlider.value = value;
    }
    for (const [action, id] of Object.entries(BIND_ELEMENTS)) {
        setText(els[id], describeKey(keyBindings[action]));
    }
    renderShortcutHints();
}

// Shortcut hints are generated from the live bindings rather than hard-coded,
// so rebinding a key updates every place it is documented.
export function renderShortcutHints() {
    const { keyBindings } = getSettings();
    const parts = Object.keys(DEFAULT_KEY_BINDINGS)
        .map((action) => `${describeKey(keyBindings[action])} = ${BIND_LABELS[action]}`);
    setText(els.shortcutsHint, `اختصارات: ${parts.join(' · ')} · Esc = إغلاق`);

    if (els.guideShortcuts) {
        els.guideShortcuts.textContent = '';
        for (const action of Object.keys(DEFAULT_KEY_BINDINGS)) {
            const li = document.createElement('li');
            const strong = document.createElement('strong');
            strong.textContent = describeKey(keyBindings[action]);
            li.append('• ', strong, `: ${BIND_LABELS[action]}`);
            els.guideShortcuts.appendChild(li);
        }
        const li = document.createElement('li');
        const strong = document.createElement('strong');
        strong.textContent = 'Esc';
        li.append('• ', strong, ': إغلاق النوافذ');
        els.guideShortcuts.appendChild(li);
    }
}

export function setRebindPrompt(action) {
    if (!els.rebindNote) return;
    setText(els.rebindNote, action
        ? `اضغط الآن المفتاح الجديد لـ «${BIND_LABELS[action]}» — أو Esc للإلغاء.`
        : 'اضغط على أي مفتاح لتغييره، ثم اضغط المفتاح الجديد.');
    for (const [id, elementId] of Object.entries(BIND_ELEMENTS)) {
        const el = els[elementId];
        if (el) el.classList.toggle('rebinding', id === action);
    }
}

// ---- Game over -----------------------------------------------------------

// Only gameplay controls lock on game over — save management, sound and the
// guide stay usable. The list is explicit so new admin buttons can never be
// caught by accident.
const GAMEPLAY_BUTTONS = [
    'makeBtn', 'sellBtn', 'autoClipperBtn', 'wireBtn', 'efficiencyBtn',
    'marketingBtn', 'expansionBtn', 'warehouseBtn', 'insuranceBtn',
    'autoSellBtn', 'decreasePriceBtn', 'increasePriceBtn', 'prestigeBtn',
];

let gameplayLocked = false;

export function isGameplayLocked() {
    return gameplayLocked;
}

export function setGameplayDisabled(disabled) {
    gameplayLocked = !!disabled;
    for (const id of GAMEPLAY_BUTTONS) {
        setDisabled(els[id], disabled, disabled ? 'انتهت اللعبة' : '');
    }
}

export function showGameOverModal() {
    snapMoneyDisplay();
    updateUI();
    setText(els.gameOverMoney, formatMoney(gameState.money));
    setText(els.gameOverSold, formatNumber(gameState.totalSold));
    setText(els.gameOverBest, formatNumber(bestLocalScore.totalSold));
    setGameplayDisabled(true);
    openModal('gameOverModal');
}

// ---- Modals --------------------------------------------------------------

// Focus management: opening a modal moves focus inside it; closing returns
// focus to where the player was. The Tab-cycle trap lives in main.js.
let lastFocusedElement = null;

export function isModalOpen() {
    return !!document.querySelector('.modal.active');
}

export function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    if (modal.classList.contains('active')) closeModal(modalId);
    else openModal(modalId);
}

export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    lastFocusedElement = document.activeElement;
    modal.classList.add('active');
    const target = modal.querySelector('button, textarea, [href], [tabindex]');
    if (target && target.focus) target.focus();
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    if (lastFocusedElement && lastFocusedElement.focus) {
        lastFocusedElement.focus();
        lastFocusedElement = null;
    }
}

export function getPriceElement() {
    return els.price;
}

export function getMakeBtn() {
    return els.makeBtn;
}

export function getSellBtn() {
    return els.sellBtn;
}

// Keyboard shortcuts drive the real buttons, so `disabled` stays the single
// source of truth for what is allowed.
export function getActionButton(action) {
    const map = {
        make: els.makeBtn,
        sell: els.sellBtn,
        wire: els.wireBtn,
        machine: els.autoClipperBtn,
    };
    return map[action] || null;
}
