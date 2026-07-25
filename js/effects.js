import { isFeedbackSuspended } from './feedback.js';

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Card elements are looked up once instead of on every flash — autoProduceTick
// alone calls flash() twice a second for the lifetime of the game.
const cardCache = new Map();

function getCard(id) {
    if (!cardCache.has(id)) cardCache.set(id, document.getElementById(id));
    return cardCache.get(id);
}

const flashTimers = new Map();

export function flash(id) {
    if (reduceMotion || isFeedbackSuspended()) return;
    const el = getCard(id);
    if (!el) return;
    el.classList.add('glow-update');
    // Restart the timer rather than letting an earlier one cut the new glow
    // short mid-animation.
    const previous = flashTimers.get(id);
    if (previous) clearTimeout(previous);
    flashTimers.set(id, setTimeout(() => {
        el.classList.remove('glow-update');
        flashTimers.delete(id);
    }, 900));
}

// ---- Particle pool -------------------------------------------------------
// Particles used to be created and destroyed per emoji: a burst of up to 8
// nodes per sale, each with its own setTimeout. Under sustained selling that
// churned hundreds of nodes a second. The pool caps live nodes and recycles
// them, and `animationend` returns each one instead of a timer per particle.

const PARTICLE_POOL_MAX = 24;
const freeParticles = [];
let particleCount = 0;

function releaseParticle(particle) {
    particle.classList.remove('floating-emoji');
    particle.style.display = 'none';
    freeParticles.push(particle);
}

function acquireParticle() {
    if (freeParticles.length) return freeParticles.pop();
    if (particleCount >= PARTICLE_POOL_MAX) return null;
    const particle = document.createElement('span');
    particle.setAttribute('aria-hidden', 'true');
    particle.addEventListener('animationend', () => releaseParticle(particle));
    document.body.appendChild(particle);
    particleCount++;
    return particle;
}

export function createFloatingEmoji(buttonElement, emoji, count = 5) {
    if (reduceMotion || isFeedbackSuspended() || !buttonElement) return;
    if (!buttonElement.getBoundingClientRect) return;
    const rect = buttonElement.getBoundingClientRect();

    for (let i = 0; i < count; i++) {
        const particle = acquireParticle();
        // Pool exhausted: drop the extra particles rather than growing the DOM.
        if (!particle) break;

        particle.textContent = emoji;
        // Coordinates come from getBoundingClientRect(), which is relative to
        // the viewport — so the particle must be positioned against the
        // viewport too. It used to be `position: absolute` inside a relatively
        // positioned body, which offset every particle by the scroll amount.
        particle.style.left = `${rect.left + rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.4}px`;
        particle.style.top = `${rect.top + rect.height / 2 + (Math.random() - 0.5) * rect.height * 0.4}px`;
        particle.style.display = '';

        // Force a reflow so re-adding the class restarts the animation on a
        // recycled node.
        particle.classList.remove('floating-emoji');
        void particle.offsetWidth;
        particle.classList.add('floating-emoji');
    }
}

let tickerEl = null;
let tickerEmojiEl = null;
let tickerMessageEl = null;
let tickerTimeout = null;

export function initTicker() {
    tickerEl = document.getElementById('newsTicker');
    tickerEmojiEl = document.getElementById('tickerEmoji');
    tickerMessageEl = document.getElementById('tickerMessage');
}

export function showNewsTicker(message, emoji, duration = 3000) {
    if (isFeedbackSuspended()) return;
    if (!tickerEl) return;
    if (tickerTimeout) {
        clearTimeout(tickerTimeout);
        tickerTimeout = null;
    }
    tickerEmojiEl.textContent = emoji;
    tickerMessageEl.textContent = message;
    tickerEl.classList.add('show');
    tickerTimeout = setTimeout(() => {
        tickerEl.classList.remove('show');
    }, duration);
}
