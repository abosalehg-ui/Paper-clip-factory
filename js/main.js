// Entry point: wires the action map, the run lifecycle (new game, prestige,
// full reset) and boot. Input handling lives in input.js; save management and
// the away-time payout live in save-ui.js.

import { gameState } from './state.js';
import {
    initAudio, playSound, setSoundsEnabled, areSoundsEnabled,
} from './audio.js';
import { initTicker, showNewsTicker } from './effects.js';
import { loadBestScore, loadGameState, startAutoSave, resetGameState } from './save.js';
import { calculateOfflineProgress } from './offline.js';
import {
    loadSettings, getSettings, setSetting, resetKeyBindings,
} from './settings.js';
import {
    initUI, updateUI, updateAutoSellToggle, renderAchievements, renderSettings,
    toggleModal, openModal, closeModal, setGameplayDisabled,
    getMakeBtn, getSellBtn, snapMoneyDisplay,
} from './ui.js';
import {
    makeClip, sellClips, buyWire, toggleAutoSell, resetInputCooldowns,
} from './production.js';
import { buyAutoClipper, buyUpgrade } from './upgrades.js';
import {
    checkTrophy, renderTrophies, checkAchievements, resetRecordTracking,
} from './achievements.js';
import { doPrestige, canPrestige } from './prestige.js';
import { startGameLoop } from './game-loop.js';
import { setupInput, beginRebind, cancelRebind } from './input.js';
import {
    exportBestScore, resetBestScoreAction, openSaveModal, doExportSave,
    doImportSave, showOfflineModal, setupVisibilityCatchUp,
} from './save-ui.js';

// Every manual action re-checks achievements so unlocks land on the action
// that earned them rather than on the next background tick.
function afterAction() {
    checkAchievements();
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
    'buy-wire-buyer': () => { buyUpgrade('wireBuyer'); afterAction(); },
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
    'reset-best-score': () => resetBestScoreAction(),
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
    resetInputCooldowns();
    setGameplayDisabled(false);
    updateAutoSellToggle();
    checkTrophy(gameState.lifetimeSold);
    renderTrophies();
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
    renderTrophies();
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

// A new worker no longer activates behind the player's back (that could mix
// two builds inside one page), so the page has to tell them it is ready and
// hand over only on reload.
function announceUpdate(worker) {
    if (!worker) return;
    showNewsTicker('تحديث جديد جاهز — أعد تحميل الصفحة لتطبيقه.', '🔄', 8000);
    worker.postMessage({ type: 'SKIP_WAITING' });
}

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').then((registration) => {
            // Only tell the player about an update when a worker is already in
            // control; on a first visit the "waiting" worker IS the first one.
            if (!navigator.serviceWorker.controller) return;
            if (registration.waiting) announceUpdate(registration.waiting);
            registration.addEventListener('updatefound', () => {
                const installing = registration.installing;
                if (!installing) return;
                installing.addEventListener('statechange', () => {
                    if (installing.state === 'installed') announceUpdate(registration.waiting);
                });
            });
        }).catch(() => {});
    });
}

function init() {
    loadSettings();
    initAudio();
    initTicker();
    initUI();

    loadBestScore();
    const saveStatus = loadGameState();

    let offlineProgress = null;
    if (saveStatus === 'loaded') {
        offlineProgress = calculateOfflineProgress();
    }

    document.addEventListener('click', handleClick);
    setupInput();
    setupVisibilityCatchUp();

    updateAutoSellToggle();
    checkTrophy(gameState.lifetimeSold);
    renderTrophies();
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

    if (saveStatus === 'corrupt') {
        showNewsTicker('تعذّرت قراءة ملف الحفظ — بدأت لعبة جديدة واحتُفظ بنسخة من الملف التالف.', '⚠️', 8000);
        playSound('warning');
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
