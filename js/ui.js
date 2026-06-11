import { gameState, bestLocalScore } from './state.js';
import { GAME_CONFIG } from './config.js';
import { formatNumber, formatMoney } from './format.js';

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

function setDisabled(el, disabled) {
    if (!el) return;
    disabled = !!disabled;
    if (el.disabled !== disabled) {
        el.disabled = disabled;
        el.setAttribute('aria-disabled', String(disabled));
    }
}

export function initUI() {
    const ids = [
        'clips', 'clipsLimit', 'clipsLimitCurrent', 'money', 'wire', 'demand',
        'autoClippers', 'autoClipperCost', 'wireCost', 'wireEfficiency',
        'efficiencyCost', 'marketingLevel', 'marketingCost', 'availableClips',
        'totalClips', 'totalSold', 'totalMachines', 'productionRate',
        'insuranceLevel', 'insuranceCost', 'maxClippers', 'expansionCost',
        'warehouseCost', 'price', 'makeBtn', 'makeBtnText', 'sellBtn',
        'autoClipperBtn', 'wireBtn', 'efficiencyBtn', 'marketingBtn',
        'expansionBtn', 'warehouseBtn', 'insuranceBtn', 'insuranceTimer',
        'autoSellBtn', 'bestTotalSold', 'bestMoney', 'bestDate',
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
    setDisabled(els.insuranceBtn, gameState.money < gameState.insuranceCost);
}

export function updateUI() {
    if (!els.clips) return;

    const efficiencyCost = gameState.wireEfficiency * GAME_CONFIG.EFFICIENCY_BASE_COST;
    const marketingCost = gameState.marketingLevel * GAME_CONFIG.MARKETING_BASE_COST;

    setText(els.clips, formatNumber(gameState.clips));
    setText(els.money, formatMoney(gameState.money));
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

    setText(els.clipsLimit, formatNumber(gameState.maxClipsLimit));
    setText(els.clipsLimitCurrent, formatNumber(gameState.maxClipsLimit));
    setText(els.warehouseCost, formatMoney(gameState.warehouseCost));

    updateInsuranceTimer();

    const warehouseFull = gameState.clips >= gameState.maxClipsLimit;
    const noWire = gameState.wire < 1;
    setDisabled(els.makeBtn, noWire || warehouseFull);
    setText(els.makeBtnText, noWire
        ? 'لا يوجد سلك'
        : warehouseFull ? 'المستودع ممتلئ' : 'صنع مشبك');

    setDisabled(els.sellBtn, gameState.clips === 0);
    setDisabled(els.autoClipperBtn,
        gameState.money < gameState.autoClipperCost ||
        gameState.autoClippers >= gameState.maxClippersLimit);
    setDisabled(els.wireBtn, gameState.money < gameState.wireCost);
    setDisabled(els.efficiencyBtn, gameState.money < efficiencyCost);
    setDisabled(els.marketingBtn, gameState.money < marketingCost);
    setDisabled(els.expansionBtn, gameState.money < gameState.expansionCost);
    setDisabled(els.warehouseBtn, gameState.money < gameState.warehouseCost);

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

export function showGameOverState() {
    document.querySelectorAll('button:not(.guide-btn)').forEach(btn => {
        btn.disabled = true;
    });
    if (els.autoSellBtn) els.autoSellBtn.disabled = true;
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

export function toggleModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.toggle('active');
}

export function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
}

export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}
