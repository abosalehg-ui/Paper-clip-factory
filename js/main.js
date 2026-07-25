import { GAME_CONFIG, DEFAULT_KEY_BINDINGS } from './config.js';
import { gameState, bestLocalScore } from './state.js';
import {
    initAudio, playSound, setSoundsEnabled, areSoundsEnabled, setVolume,
} from './audio.js';
import { initTicker, showNewsTicker } from './effects.js';
import {
    loadBestScore, loadGameState, startAutoSave,
    resetGameState, resetBestScore,
    exportSaveString, importSaveString,
} from './save.js';
import { calculateOfflineProgress } from './offline.js';
import {
    loadSettings, getSettings, setSetting, setKeyBinding, resetKeyBindings,
    actionForKey,
} from './settings.js';
import {
    initUI, updateUI, updateAutoSellToggle, renderAchievements, renderSettings,
    setRebindPrompt, toggleModal, openModal, closeModal, setGameplayDisabled,
    isGameplayLocked, isModalOpen, getPriceElement, getMakeBtn, getSellBtn,
    getActionButton, snapMoneyDisplay,
} from './ui.js';
import {
    makeClip, sellClips, buyWire, adjustPrice, setPrice,
    toggleAutoSell, resetSellCooldown,
} from './production.js';
import { buyAutoClipper, buyUpgrade } from './upgrades.js';
import { checkTrophy, checkAchievements, resetRecordTracking } from './achievements.js';
import { doPrestige, canPrestige } from './prestige.js';
import { startGameLoop, resetLoopTimers } from './game-loop.js';

// Every manual action re-checks achievements so unlocks land on the action
// that earned them rather than on the next background tick.
function afterAction() {
    checkAchievements();
    updateUI();
}

// ---- Price buttons -------------------------------------------------------
// Holding accelerates: the repeat delay decays toward a floor, so moving the
// price a long way no longer takes a minute and a half of held input.

let priceAdjustTimer = null;
let priceAdjustDelay = GAME_CONFIG.PRICE_ADJUST_INTERVAL_MS;

function schedulePriceAdjust(delta) {
    priceAdjustTimer = setTimeout(() => {
        adjustPrice(delta);
        updateUI();
        priceAdjustDelay = Math.max(
            GAME_CONFIG.PRICE_ADJUST_MIN_INTERVAL_MS,
            priceAdjustDelay * GAME_CONFIG.PRICE_ADJUST_ACCELERATION,
        );
        schedulePriceAdjust(delta);
    }, priceAdjustDelay);
}

function startPriceAdjust(delta) {
    stopPriceAdjust();
    adjustPrice(delta);
    updateUI();
    priceAdjustDelay = GAME_CONFIG.PRICE_ADJUST_INTERVAL_MS;
    schedulePriceAdjust(delta);
}

function stopPriceAdjust() {
    if (priceAdjustTimer) {
        clearTimeout(priceAdjustTimer);
        priceAdjustTimer = null;
    }
    priceAdjustDelay = GAME_CONFIG.PRICE_ADJUST_INTERVAL_MS;
}

function handlePriceEdit() {
    const priceEl = getPriceElement();
    const newPriceStr = priceEl.textContent.trim().replace(/[^\d.]/g, '');
    const newPrice = parseFloat(newPriceStr);
    // setPrice clamps into [MIN_PRICE, chokePrice]; on invalid input the state
    // price is left unchanged. Either way we re-render from the authoritative
    // state, so the field can never show a price the economy does not honour.
    setPrice(newPrice);
    priceEl.textContent = gameState.price.toFixed(2);
    updateUI();
}

// ---- Actions -------------------------------------------------------------

const actions = {
    'make-clip': () => { makeClip(getMakeBtn()); afterAction(); },
    'sell-clips': () => { sellClips(getSellBtn()); afterAction(); },
    'buy-wire': () => { buyWire(); afterAction(); },
    'buy-auto-clipper': () => { buyAutoClipper(); afterAction(); },
    'increase-marketing': () => { buyUpgrade('marketing'); afterAction(); },
    'upgrade-warehouse': () => { buyUpgrade('warehouse'); afterAction(); },
    'buy-wire-efficiency': () => { buyUpgrade('efficiency'); afterAction(); },
    'buy-expansion': () => { buyUpgrade('expansion'); afterAction(); },
    'buy-insurance': () => { buyUpgrade('insurance'); afterAction(); },
    'toggle-auto-sell': () => { toggleAutoSell(); updateAutoSellToggle(); afterAction(); },
    'toggle-guide': () => toggleModal('guideModal'),
    'new-game': () => startFreshRun('لعبة جديدة! بالتوفيق 🍀'),
    'do-prestige': () => doPrestigeAction(),
    'toggle-achievements': () => { renderAchievements(); toggleModal('achievementsModal'); },
    'close-achievements': () => closeModal('achievementsModal'),
    'open-settings': () => { renderSettings(); openModal('settingsModal'); },
    'close-settings': () => { cancelRebind(); closeModal('settingsModal'); },
    'toggle-sound': () => doToggleSound(),
    'toggle-reduce-flash': () => doToggleReduceFlash(),
    'rebind': (target) => beginRebind(target && target.dataset.bind),
    'reset-keybinds': () => { resetKeyBindings(); cancelRebind(); renderSettings(); },
    'reset-best-score': () => {
        if (!confirm('هل أنت متأكد من إعادة تعيين أفضل النتائج؟')) return;
        resetBestScore();
        resetRecordTracking();
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
};

// Shared by "new game", the game-over restart and a full reset: all three need
// exactly the same revival sequence.
function startFreshRun(message, { keepPrestige = true } = {}) {
    resetGameState({ keepPrestige });
    resetRecordTracking();
    resetSellCooldown();
    document.body.classList.remove('trophy-bronze', 'trophy-silver', 'trophy-gold');
    setGameplayDisabled(false);
    updateAutoSellToggle();
    checkTrophy(gameState.totalSold);
    snapMoneyDisplay();
    closeModal('gameOverModal');
    updateUI();
    startGameLoop();
    if (message) showNewsTicker(message, '📎', 3500);
}

function doPrestigeAction() {
    if (!canPrestige()) return;
    if (!confirm('سيتم إعادة تشغيل المصنع من الصفر مقابل نقاط دائمة. هل أنت متأكد؟')) return;
    if (doPrestige() <= 0) return;
    checkAchievements();
    // doPrestige already reset the run state; this brings the UI, the loop and
    // the record tracking back in line with it.
    startFreshRun(null);
}

function exportBestScore() {
    const { totalSold, money, date } = bestLocalScore;
    const text = `أفضل مبيعات محلية: ${totalSold.toLocaleString()} مشبك — المال: $${parseFloat(money || 0).toFixed(2)} — التاريخ: ${date ? new Date(date).toLocaleString() : '—'}`;
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
        checkAchievements();
        updateAutoSellToggle();
        resetSellCooldown();
        snapMoneyDisplay();
        // If we were on the game-over screen, the imported save revives play.
        setGameplayDisabled(false);
        closeModal('gameOverModal');
        updateUI();
        closeModal('saveModal');
        startGameLoop();
    } else {
        showNewsTicker('فشل استيراد الحفظ — البيانات غير صالحة.', '❌', 3500);
        playSound('warning');
    }
}

function doResetGame() {
    if (!confirm('تحذير: سيتم حذف كل تقدمك، بما في ذلك نقاط إعادة التأسيس. هل أنت متأكد؟')) return;
    startFreshRun('تمت إعادة ضبط اللعبة.', { keepPrestige: false });
    closeModal('saveModal');
    playSound('completion');
}

function doToggleSound() {
    setSoundsEnabled(!areSoundsEnabled());
    renderSettings();
    if (areSoundsEnabled()) playSound('click');
}

function doToggleReduceFlash() {
    setSetting('reduceFlash', !getSettings().reduceFlash);
    renderSettings();
    // Re-apply the trophy aura (or remove it) immediately.
    checkTrophy(gameState.totalSold);
}

// ---- Key rebinding -------------------------------------------------------

let pendingRebind = null;

function beginRebind(action) {
    if (!action || !(action in DEFAULT_KEY_BINDINGS)) return;
    pendingRebind = action;
    setRebindPrompt(action);
}

function cancelRebind() {
    pendingRebind = null;
    setRebindPrompt(null);
}

// Returns true when the press was consumed as a rebind.
function handleRebindKey(e) {
    if (!pendingRebind) return false;
    e.preventDefault();
    if (e.key === 'Escape') {
        cancelRebind();
        return true;
    }
    if (e.key === 'Tab') return false;
    if (setKeyBinding(pendingRebind, e.key)) {
        cancelRebind();
        renderSettings();
    } else {
        showNewsTicker('هذا المفتاح مستخدم بالفعل — اختر مفتاحاً آخر.', '⚠️', 2500);
    }
    return true;
}

// ---- Input wiring --------------------------------------------------------

function handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (actions[action]) {
        actions[action](target);
    }
}

function setupPriceButtons() {
    const decreaseBtn = document.getElementById('decreasePriceBtn');
    const increaseBtn = document.getElementById('increasePriceBtn');
    const delta = GAME_CONFIG.PRICE_ADJUST_DELTA;

    const press = (button, amount) => {
        button.addEventListener('mousedown', () => {
            if (!button.disabled) startPriceAdjust(amount);
        });
        button.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (!button.disabled) startPriceAdjust(amount);
        });
    };
    press(decreaseBtn, -delta);
    press(increaseBtn, delta);

    document.addEventListener('mouseup', stopPriceAdjust);
    document.addEventListener('touchend', stopPriceAdjust);
    document.addEventListener('touchcancel', stopPriceAdjust);
    // Alt-Tab away mid-press never delivered a mouseup, so the price kept
    // running on its own until the player came back.
    window.addEventListener('blur', stopPriceAdjust);
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

function setupVolumeSlider() {
    const slider = document.getElementById('volumeSlider');
    if (!slider) return;
    slider.addEventListener('input', () => {
        setVolume(Number(slider.value) / 100);
        renderSettings();
    });
}

// Keep Tab inside the topmost open modal (simple focus trap).
function trapModalTab(e) {
    const modal = document.querySelector('.modal.active');
    if (!modal) return;
    const focusables = modal.querySelectorAll(
        'button:not(:disabled), textarea, input, [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}

function closeTopModals() {
    // The game-over modal is the only path back into the game — it must not be
    // dismissable into a dead screen.
    document.querySelectorAll('.modal.active').forEach((m) => {
        if (m.id !== 'gameOverModal') m.classList.remove('active');
    });
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (handleRebindKey(e)) return;

        if (e.key === 'Tab') {
            trapModalTab(e);
            return;
        }
        if (e.key === 'Escape') {
            closeTopModals();
            return;
        }
        // Never hijack browser/system shortcuts (Ctrl+A must not buy a machine).
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        // Shortcuts used to fire straight through an open dialog — a player
        // reading the guide was silently making and selling clips behind it.
        if (isModalOpen() || isGameplayLocked()) return;

        const action = actionForKey(e.key);
        if (!action) return;
        // Space/Enter on a focused button is the browser's job, not ours.
        if ((e.key === ' ' || e.key === 'Enter') && e.target.tagName === 'BUTTON') return;

        // Route through the real button so its `disabled` state stays the
        // single source of truth for what is currently allowed.
        const button = getActionButton(action);
        if (!button || button.disabled) {
            e.preventDefault();
            return;
        }
        e.preventDefault();
        button.click();
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

// rAF (and thus production) pauses while the tab is hidden. On return, pay
// out the away time through the same offline-progress engine used at load,
// then re-anchor the loop timers so the pause is not seen as one huge tick.
function setupVisibilityCatchUp() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        const progress = calculateOfflineProgress();
        resetLoopTimers();
        if (progress && progress.clipsProduced > 0) {
            const sold = progress.clipsSold
                ? ` وبيع ${progress.clipsSold.toLocaleString()} مشبك`
                : '';
            showNewsTicker(`⏰ أثناء غيابك: إنتاج ${progress.clipsProduced.toLocaleString()} مشبك${sold}!`, '🏭', 5000);
            snapMoneyDisplay();
            afterAction();
        }
    });
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js').catch(() => {});
        });
    }
}

function init() {
    loadSettings();
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
    setupVolumeSlider();
    setupKeyboardShortcuts();
    setupVisibilityCatchUp();

    updateAutoSellToggle();
    checkTrophy(gameState.totalSold);
    checkAchievements();
    renderSettings();
    snapMoneyDisplay();
    updateUI();

    // The guide no longer opens itself on first launch: fifteen bullet points
    // before the player has seen a button was the worst part of onboarding.
    // The objective bar teaches one step at a time instead, and the full guide
    // stays one tap away behind "?".
    if (offlineProgress && offlineProgress.clipsProduced > 0) {
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
