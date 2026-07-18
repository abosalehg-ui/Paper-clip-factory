const soundCache = {};

// Rapid repeats (clicking, auto-sell cash) used to hard-reset the single
// <audio> element mid-play, clipping the sound. A small pool of clones lets
// a few instances overlap naturally.
const POOL_SIZE = 3;
const soundPools = {};

let soundsEnabled = true;

export function initAudio() {
    soundCache.click = document.getElementById('clickSound');
    soundCache.cash = document.getElementById('cashSound');
    soundCache.buy = document.getElementById('buySound');
    soundCache.trophy = document.getElementById('trophySound');
    soundCache.warning = document.getElementById('warningSound');
    soundCache.fire = document.getElementById('fireSound');
    soundCache.fail = document.getElementById('failSound');
    soundCache.completion = document.getElementById('completionSound');
}

export function playSound(name) {
    if (!soundsEnabled) return;
    const base = soundCache[name];
    if (!base) return;
    try {
        let pool = soundPools[name];
        if (!pool) pool = soundPools[name] = [base];
        let audio = pool.find((a) => a.paused || a.ended);
        if (!audio) {
            if (pool.length < POOL_SIZE) {
                audio = base.cloneNode();
                pool.push(audio);
            } else {
                audio = pool[0];
            }
        }
        audio.currentTime = 0;
        audio.play().catch(() => {});
    } catch {
        // Autoplay restrictions or detached elements — never break gameplay.
    }
}

export function setSoundsEnabled(enabled) {
    soundsEnabled = enabled;
}

export function areSoundsEnabled() {
    return soundsEnabled;
}
