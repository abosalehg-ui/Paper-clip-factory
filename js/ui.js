import { gameState, bestLocalScore } from './state.js';
import { getUpgradeCost } from './upgrades.js';
import { formatNumber, formatMoney } from './format.js';
import { reduceMotion } from './effects.js';

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

const REASON_NO_MONEY = 'مال غير كافٍ';

export function initUI() {
    const ids = [
        'clips', 'clipsLimitCurrent', 'money', 'wire', 'demand',
        'autoClippers', 'autoClipperCost', 'wireCost', 'wireEfficiency',
        'efficiencyCost', 'marketingLevel', 'marketingCost', 'availableClips',
        'totalClips', 'totalSold', 'totalMachines', 'productionRate',
        'insuranceLevel', 'insuranceCost', 'maxClippers', 'expansionCost',
        'warehouseCost', 'price', 'makeBtn', 'makeBtnText', 'sellBtn',
        'autoClipperBtn', 'wireBtn', 'efficiencyBtn', 'marketingBtn',
        'expansionBtn', 'warehouseBtn', 'insuranceBtn', 'insuranceTimer',
        'autoSellBtn', 'bestTotalSold', 'bestMoney', 'bestDate',
        'decreasePriceBtn', 'increasePriceBtn',
        'gameOverMoney', 'gameOverSold', 'gameOverBest',
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
    setDisabled(els.insuranceBtn, gameState.money < gameState.insuranceCost, REASON_NO_MONEY);
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

export function updateUI() {
    if (!els.clips) return;

    const efficiencyCost = getUpgradeCost('efficiency');
    const marketingCost = getUpgradeCost('marketing');

    setText(els.clips, formatNumber(gameState.clips));
    setText(els.money, formatMoney(easedMoney()));
    setText(els.wire, formatNumber(gameState.wire));
    setText(els.demand, gameState.demand);

    if (document.activeElement !== els.price) {
        setText(els.price, gameState.price.toFixed(2));
    }

    setText(els.autoClippers, formatNumber(gameState.autoClippers));
    setText(els.autoClipperCost, formatMoney(gameState.autoClipperCost));
    setText(els.wireCost, formatMoney(gameState.wireCost));
    setText(els.wireEfficiency, gameState.wireEfficiency.toFixed(1));
    setText(els.efficiencyCost, formatMoney(efficiencyCost));
    setText(els.marketingLevel, gameState.marketingLevel);
    setText(els.marketingCost, formatMoney(marketingCost));
    setText(els.availableClips, formatNumber(gameState.clips));
    setText(els.totalClips, formatNumber(gameState.totalClips));
    setText(els.totalSold, formatNumber(gameState.totalSold));
    setText(els.totalMachines, formatNumber(gameState.autoClippers));
    setText(els.productionRate, formatNumber(gameState.autoClipperRate));

    setText(els.insuranceLevel, gameState.insuranceLevel);
    setText(els.insuranceCost, formatMoney(gameState.insuranceCost));

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

    setText(els.bestTotalSold, formatNumber(bestLocalScore.totalSold));
    setText(els.bestMoney, formatMoney(bestLocalScore.money || 0));
    setText(els.bestDate, bestLocalScore.date
        ? new Date(bestLocalScore.date).toLocaleString()
        : '—');
}

export function updateAutoSellToggle() {
    if (!els.autoSellBtn) return;
    els.autoSellBtn.className = gameState.autoSellEnabled
        ? 'toggle-btn toggle-on'
        : 'toggle-btn toggle-off';
    els.autoSellBtn.setAttribute('aria-pressed', String(gameState.autoSellEnabled));
}

// Only gameplay controls lock on game over — save management, sound and the
// guide stay usable. The list is explicit so new admin buttons can never be
// caught by accident.
const GAMEPLAY_BUTTONS = [
    'makeBtn', 'sellBtn', 'autoClipperBtn', 'wireBtn', 'efficiencyBtn',
    'marketingBtn', 'expansionBtn', 'warehouseBtn', 'insuranceBtn',
    'autoSellBtn', 'decreasePriceBtn', 'increasePriceBtn',
];

export function setGameplayDisabled(disabled) {
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

// Focus management: opening a modal moves focus inside it; closing returns
// focus to where the player was. The Tab-cycle trap lives in main.js.
let lastFocusedElement = null;

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
