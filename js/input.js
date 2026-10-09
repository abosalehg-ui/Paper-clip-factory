// Player input: price buttons and the price field, the volume slider,
// keyboard shortcuts, key rebinding and the modal focus trap. Clicks on
// [data-action] buttons are routed by main.js.

import { GAME_CONFIG, DEFAULT_KEY_BINDINGS } from './config.js';
import { gameState } from './state.js';
import { setVolume } from './audio.js';
import { showNewsTicker } from './effects.js';
import { setKeyBinding, actionForKey } from './settings.js';
import {
    updateUI, renderSettings, setRebindPrompt, isGameplayLocked, isModalOpen,
    getPriceElement, getActionButton,
} from './ui.js';
import { adjustPrice, setPrice } from './production.js';

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
    const newPriceStr = priceEl.value.trim().replace(/[^\d.]/g, '');
    const newPrice = parseFloat(newPriceStr);
    // setPrice clamps into [MIN_PRICE, chokePrice]; on invalid input the state
    // price is left unchanged. Either way we re-render from the authoritative
    // state, so the field can never show a price the economy does not honour.
    setPrice(newPrice);
    priceEl.value = gameState.price.toFixed(2);
    updateUI();
}

// ---- Key rebinding -------------------------------------------------------

let pendingRebind = null;

export function beginRebind(action) {
    if (!action || !(action in DEFAULT_KEY_BINDINGS)) return;
    pendingRebind = action;
    setRebindPrompt(action);
}

export function cancelRebind() {
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

export function setupInput() {
    setupPriceButtons();
    setupPriceEdit();
    setupVolumeSlider();
    setupKeyboardShortcuts();
}
