// Time-source hardening for offline progress.
//
// Offline credit is computed from a wall-clock difference, and the wall clock
// belongs to the player. Winding it forward (or hand-editing `lastSaveTime`)
// used to mint a full offline payout on demand.
//
// performance.now() is monotonic and keeps running while a tab is hidden, so
// within one page session it is a trustworthy second opinion: if the wall
// clock claims far more elapsed time than the monotonic clock did, the excess
// did not happen.
//
// Across a reload there is no monotonic anchor to compare against — without a
// server there is no trustworthy time source at all — so that path stays
// bounded only by OFFLINE_PROGRESS_CAP_MS. This is a deliberate limit, not an
// oversight: a single-player offline game cannot do better locally.

// Tolerance for clocks that legitimately disagree (OS suspend, timer
// coalescing). Discrepancies under this are ignored rather than clawed back.
const CLOCK_SKEW_TOLERANCE_MS = 60000;

let anchorPerf = null;

function monotonicNow() {
    if (typeof performance === 'undefined' || typeof performance.now !== 'function') return null;
    return performance.now();
}

export function markClockAnchor() {
    anchorPerf = monotonicNow();
}

export function clearClockAnchor() {
    anchorPerf = null;
}

export function trustedElapsedMs(wallElapsedMs) {
    const perfNow = monotonicNow();
    if (anchorPerf === null || perfNow === null) return wallElapsedMs;

    const monotonicElapsed = Math.max(0, perfNow - anchorPerf);
    if (wallElapsedMs <= monotonicElapsed + CLOCK_SKEW_TOLERANCE_MS) return wallElapsedMs;
    return monotonicElapsed;
}
