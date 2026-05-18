import { gameState, bestLocalScore } from './state.js';

const els = {};

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
        els.insuranceTimer.textContent =
            `التأمين نشط: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        els.insuranceTimer.style.display = 'block';
    } else {
        gameState.insuranceEndTime = 0;
        els.insuranceTimer.textContent = '';
        els.insuranceTimer.style.display = 'none';
    }
    els.insuranceBtn.disabled = gameState.money < gameState.insuranceCost;
}

export function updateUI() {
    if (!els.clips) return;
    els.clips.textContent = gameState.clips.toLocaleString();
    els.money.textContent = gameState.money.toFixed(2);
    els.wire.textContent = gameState.wire.toLocaleString();
    els.demand.textContent = gameState.demand;

    if (document.activeElement !== els.price) {
        els.price.textContent = gameState.price.toFixed(2);
    }

    els.autoClippers.textContent = gameState.autoClippers;
    els.autoClipperCost.textContent = gameState.autoClipperCost.toFixed(2);
    els.wireCost.textContent = gameState.wireCost.toFixed(2);
    els.wireEfficiency.textContent = gameState.wireEfficiency.toFixed(1);
    els.efficiencyCost.textContent = (gameState.wireEfficiency * 1000).toFixed(2);
    els.marketingLevel.textContent = gameState.marketingLevel;
    els.marketingCost.textContent = (gameState.marketingLevel * 100).toFixed(2);
    els.availableClips.textContent = gameState.clips;
    els.totalClips.textContent = gameState.totalClips.toLocaleString();
    els.totalSold.textContent = gameState.totalSold.toLocaleString();
    els.totalMachines.textContent = gameState.autoClippers;
    els.productionRate.textContent = gameState.autoClipperRate;

    els.insuranceLevel.textContent = gameState.insuranceLevel;
    els.insuranceCost.textContent = gameState.insuranceCost.toFixed(2);

    els.maxClippers.textContent = gameState.maxClippersLimit.toLocaleString();
    els.expansionCost.textContent = gameState.expansionCost.toFixed(2);

    els.clipsLimit.textContent = gameState.maxClipsLimit.toLocaleString();
    els.clipsLimitCurrent.textContent = gameState.maxClipsLimit.toLocaleString();
    els.warehouseCost.textContent = gameState.warehouseCost.toFixed(2);

    updateInsuranceTimer();

    els.makeBtn.disabled = gameState.wire < 1 || gameState.clips >= gameState.maxClipsLimit;
    els.makeBtnText.textContent = gameState.wire < 1
        ? 'لا يوجد سلك'
        : gameState.clips >= gameState.maxClipsLimit
            ? 'المستودع ممتلئ'
            : 'صنع مشبك';

    els.sellBtn.disabled = gameState.clips === 0;
    els.autoClipperBtn.disabled =
        gameState.money < gameState.autoClipperCost ||
        gameState.autoClippers >= gameState.maxClippersLimit;
    els.wireBtn.disabled = gameState.money < gameState.wireCost;
    els.efficiencyBtn.disabled = gameState.money < gameState.wireEfficiency * 1000;
    els.marketingBtn.disabled = gameState.money < gameState.marketingLevel * 100;
    els.expansionBtn.disabled = gameState.money < gameState.expansionCost;
    els.warehouseBtn.disabled = gameState.money < gameState.warehouseCost;

    els.bestTotalSold.textContent = bestLocalScore.totalSold.toLocaleString();
    els.bestMoney.textContent = parseFloat(bestLocalScore.money || 0).toFixed(2);
    els.bestDate.textContent = bestLocalScore.date
        ? new Date(bestLocalScore.date).toLocaleString()
        : '—';
}

export function updateAutoSellToggle() {
    if (!els.autoSellBtn) return;
    els.autoSellBtn.className = gameState.autoSellEnabled
        ? 'toggle-btn toggle-on'
        : 'toggle-btn toggle-off';
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
