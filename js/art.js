// Illustrated art layered over the emoji the markup ships with.
//
// Every `[data-art]` span keeps its emoji as the fallback: the picture only
// replaces it once the image has actually loaded, so a failed fetch (first
// visit offline, a blocked request) leaves the button exactly as it was
// instead of blank.

const ART_DIR = 'assets/images/art';

export function iconUrl(name) {
    return `${ART_DIR}/icon-${name}.webp`;
}

// The banner grows with the automated fleet. Thresholds sit on milestones the
// player already sees: the first machine, a quarter of the starting cap, and
// the full starting cap of 100.
export const FACTORY_STAGES = [
    { minMachines: 0, label: 'ورشة يدوية' },
    { minMachines: 1, label: 'ورشة آلية' },
    { minMachines: 25, label: 'مصنع' },
    { minMachines: 100, label: 'مصنع عملاق' },
];

// 1-based stage index for a given machine count.
export function factoryStage(machines) {
    let stage = 1;
    for (let i = 0; i < FACTORY_STAGES.length; i++) {
        if (machines >= FACTORY_STAGES[i].minMachines) stage = i + 1;
    }
    return stage;
}

export function factoryStageUrl(stage) {
    return `${ART_DIR}/factory-stage-${stage}.webp`;
}

export function badgeUrl(id) {
    return `${ART_DIR}/badge-${id}.webp`;
}

export function trophyUrl(tier) {
    return `${ART_DIR}/trophy-${tier}.webp`;
}

export function eventUrl(name) {
    return `${ART_DIR}/event-${name}.webp`;
}

// Puts the picture at `url` in place of `el`'s emoji once it loads. Elements
// that are reused (the news ticker) can be re-targeted before an earlier
// load finishes, so a load only lands if it is still the one asked for.
// Pass a null url to drop any pending swap and keep the current text.
export function applyArt(el, url) {
    if (!el) return;
    el._artUrl = url;
    el.classList?.remove('has-art');
    if (!url || typeof Image === 'undefined') return;
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.className = 'art-icon';
    img.addEventListener('load', () => {
        if (el._artUrl !== url) return;
        el.textContent = '';
        el.append(img);
        el.classList.add('has-art');
    }, { once: true });
    img.src = url;
}

export function initArt(root = document) {
    for (const el of root.querySelectorAll('[data-art]')) {
        applyArt(el, iconUrl(el.dataset.art));
    }
}
