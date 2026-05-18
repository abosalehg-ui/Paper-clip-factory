import { GAME_CONFIG } from './config.js';
import { gameState } from './state.js';
import { initAudio, playSound, setSoundsEnabled, areSoundsEnabled } from './audio.js';
import { initTicker, showNewsTicker, flash } from './effects.js';
import {
    loadBestScore, loadGameState, saveGameState, startAutoSave,
    calculateOfflineProgress, resetGameState, resetBestScore,
    exportSaveString, importSaveString,
} from './save.js';
import {
    initUI, updateUI, updateAutoSellToggle,
    toggleModal, openModal, closeModal,
    getPriceElement, getMakeBtn, getSellBtn,
} from './ui.js';
import {
    makeClip, sellClips, buyWire, adjustPrice, setPrice,
    toggleAutoSell,
} from './production.js';
import {
    buyAutoClipper, increaseMarketing, upgradeWarehouse,
    buyWireEfficiency, buyExpansion, buyInsurance,
} from './upgrades.js';
import { checkTrophy } from './achievements.js';
import { startGameLoop } from './game-loop.js';

let priceAdjustInterval = null;

function startPriceAdjust(delta) {
    adjustPrice(delta);
    updateUI();
    if (priceAdjustInterval) clearInterval(priceAdjustInterval);
    priceAdjustInterval = setInterval(() => {
        adjustPrice(delta);
        updateUI();
    }, GAME_CONFIG.PRICE_ADJUST_INTERVAL_MS);
}

function stopPriceAdjust() {
    if (priceAdjustInterval) {
        clearInterval(priceAdjustInterval);
        priceAdjustInterval = null;
    }
}

function handlePriceEdit() {
    const priceEl = getPriceElement();
    let newPriceStr = priceEl.textContent.trim().replace(/[^\d.]/g, '');
    const newPrice = parseFloat(newPriceStr);
    if (!setPrice(newPrice)) {
        priceEl.textContent = gameState.price.toFixed(2);
    } else {
        priceEl.textContent = gameState.price.toFixed(2);
    }
    updateUI();
}

const actions = {
    'make-clip': () => { makeClip(getMakeBtn()); updateUI(); },
    'sell-clips': () => { sellClips(getSellBtn()); updateUI(); },
    'buy-wire': () => { buyWire(); updateUI(); },
    'buy-auto-clipper': () => { buyAutoClipper(); updateUI(); },
    'increase-marketing': () => { increaseMarketing(); updateUI(); },
    'upgrade-warehouse': () => { upgradeWarehouse(); updateUI(); },
    'buy-wire-efficiency': () => { buyWireEfficiency(); updateUI(); },
    'buy-expansion': () => { buyExpansion(); updateUI(); },
    'buy-insurance': () => { buyInsurance(); updateUI(); },
    'toggle-auto-sell': () => { toggleAutoSell(); updateAutoSellToggle(); },
    'toggle-guide': () => toggleModal('guideModal'),
    'reset-best-score': () => {
        if (!confirm('هل أنت متأكد من إعادة تعيين أفضل النتائج؟')) return;
        resetBestScore();
        updateUI();
        showNewsTicker('تمت إعادة تعيين النتائج المحلية.', '🔄', 3500);
        playSound('completion');
    },
    'export-best-score': () => exportBestScore(),
    'open-save-modal': () => openSaveModal(),
    'close-save-modal': () => closeModal('saveModal'),
    'close-offline-modal': () => closeModal('offlineModal'),
    'do-export-save': () => doExportSave(),
    'do-import-save': () => doImportSave(),
    'do-reset-game': () => doResetGame(),
    'toggle-sound': () => doToggleSound(),
};

function exportBestScore() {
    const { totalSold, money, date } = gameState;
    const text = `أفضل مبيعات محلية: ${totalSold.toLocaleString()} مشبك — المال: $${money.toFixed(2)} — التاريخ: ${date ? new Date(date).toLocaleString() : '—'}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => {
                showNewsTicker('تم نسخ النتيجة إلى الحافظة!', '📋', 3500);
                playSound('completion');
            })
            .catch(() => alert(text));
    } else {
        alert(text);
    }
}

function openSaveModal() {
    openModal('saveModal');
    const textarea = document.getElementById('saveDataTextarea');
    if (textarea) textarea.value = '';
}

function doExportSave() {
    const encoded = exportSaveString();
    const textarea = document.getElementById('saveDataTextarea');
    if (textarea) textarea.value = encoded;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(encoded)
            .then(() => showNewsTicker('تم نسخ بيانات الحفظ إلى الحافظة!', '📋', 3500))
            .catch(() => showNewsTicker('تم تصدير الحفظ في الصندوق أدناه.', '📋', 3500));
    } else {
        showNewsTicker('تم تصدير الحفظ في الصندوق أدناه.', '📋', 3500);
    }
    playSound('completion');
}

function doImportSave() {
    const textarea = document.getElementById('saveDataTextarea');
    if (!textarea || !textarea.value.trim()) {
        showNewsTicker('الرجاء لصق بيانات الحفظ أولاً.', '⚠️', 3000);
        return;
    }
    if (!confirm('سيتم استبدال تقدمك الحالي. هل أنت متأكد؟')) return;
    if (importSaveString(textarea.value)) {
        showNewsTicker('تم استيراد الحفظ بنجاح!', '✅', 3500);
        playSound('completion');
        checkTrophy(gameState.totalSold);
        updateAutoSellToggle();
        updateUI();
        closeModal('saveModal');
    } else {
        showNewsTicker('فشل استيراد الحفظ — البيانات غير صالحة.', '❌', 3500);
        playSound('warning');
    }
}

function doResetGame() {
    if (!confirm('تحذير: سيتم حذف كل تقدمك. هل أنت متأكد؟')) return;
    resetGameState();
    document.body.classList.remove('trophy-bronze', 'trophy-silver', 'trophy-gold');
    updateAutoSellToggle();
    checkTrophy(gameState.totalSold);
    updateUI();
    closeModal('saveModal');
    showNewsTicker('تمت إعادة ضبط اللعبة.', '🔄', 3500);
    playSound('completion');
}

function doToggleSound() {
    setSoundsEnabled(!areSoundsEnabled());
    const btn = document.getElementById('soundToggleBtn');
    if (btn) {
        btn.textContent = areSoundsEnabled() ? '🔊 الصوت: مفعّل' : '🔇 الصوت: مكتوم';
    }
    if (areSoundsEnabled()) playSound('click');
}

function handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (actions[action]) {
        actions[action]();
    }
}

function setupPriceButtons() {
    const decreaseBtn = document.getElementById('decreasePriceBtn');
    const increaseBtn = document.getElementById('increasePriceBtn');
    const delta = GAME_CONFIG.PRICE_ADJUST_DELTA;

    decreaseBtn.addEventListener('mousedown', () => startPriceAdjust(-delta));
    decreaseBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startPriceAdjust(-delta); });
    increaseBtn.addEventListener('mousedown', () => startPriceAdjust(delta));
    increaseBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startPriceAdjust(delta); });

    document.addEventListener('mouseup', stopPriceAdjust);
    document.addEventListener('touchend', stopPriceAdjust);
    document.addEventListener('touchcancel', stopPriceAdjust);
}

function setupPriceEdit() {
    const priceEl = getPriceElement();
    priceEl.addEventListener('blur', handlePriceEdit);
    priceEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            priceEl.blur();
        }
    });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        const key = e.key.toLowerCase();
        if (key === ' ' || key === 'enter') {
            if (e.target.tagName !== 'BUTTON') {
                e.preventDefault();
                actions['make-clip']();
            }
        } else if (key === 's') {
            actions['sell-clips']();
        } else if (key === 'b') {
            actions['buy-wire']();
        } else if (key === 'a') {
            actions['buy-auto-clipper']();
        } else if (key === 'escape') {
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        }
    });
}

function showOfflineModal(progress) {
    if (!progress || progress.clipsProduced <= 0) return;
    const modal = document.getElementById('offlineModal');
    if (!modal) return;
    const elapsedMin = Math.floor(progress.elapsedMs / 60000);
    document.getElementById('offlineTimeAway').textContent = elapsedMin >= 60
        ? `${Math.floor(elapsedMin / 60)} ساعة و${elapsedMin % 60} دقيقة`
        : `${elapsedMin} دقيقة`;
    document.getElementById('offlineClipsProduced').textContent = progress.clipsProduced.toLocaleString();
    document.getElementById('offlineMoneyEarned').textContent = `$${(progress.moneyEarned || 0).toFixed(2)}`;
    document.getElementById('offlineClipsSold').textContent = (progress.clipsSold || 0).toLocaleString();
    modal.classList.add('active');
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js').catch(() => {});
        });
    }
}

function init() {
    initAudio();
    initTicker();
    initUI();

    loadBestScore();
    const hadSave = loadGameState();

    let offlineProgress = null;
    if (hadSave) {
        offlineProgress = calculateOfflineProgress();
    }

    document.addEventListener('click', handleClick);
    setupPriceButtons();
    setupPriceEdit();
    setupKeyboardShortcuts();

    updateAutoSellToggle();
    checkTrophy(gameState.totalSold);
    updateUI();

    if (!hadSave) {
        openModal('guideModal');
    } else if (offlineProgress && offlineProgress.clipsProduced > 0) {
        showOfflineModal(offlineProgress);
    }

    startGameLoop();
    startAutoSave();
    registerServiceWorker();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
