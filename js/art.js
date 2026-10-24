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

export function initArt(root = document) {
    if (typeof Image === 'undefined') return;
    for (const el of root.querySelectorAll('[data-art]')) {
        const img = new Image();
        img.alt = '';
        img.decoding = 'async';
        img.className = 'art-icon';
        img.addEventListener('load', () => {
            el.textContent = '';
            el.append(img);
            el.classList.add('has-art');
        }, { once: true });
        img.src = iconUrl(el.dataset.art);
    }
}
