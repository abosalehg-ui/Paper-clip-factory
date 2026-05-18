const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function flash(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('glow-update');
    setTimeout(() => el.classList.remove('glow-update'), 900);
}

export function createFloatingEmoji(buttonElement, emoji, count = 5) {
    if (reduceMotion || !buttonElement) return;
    const rect = buttonElement.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
        const particle = document.createElement('span');
        particle.textContent = emoji;
        particle.classList.add('floating-emoji');

        const x = rect.left + rect.width / 2 + (Math.random() - 0.5) * rect.width * 0.4;
        const y = rect.top + rect.height / 2 + (Math.random() - 0.5) * rect.height * 0.4;

        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;

        document.body.appendChild(particle);

        setTimeout(() => {
            particle.remove();
        }, 1200);
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
