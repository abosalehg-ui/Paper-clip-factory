const soundCache = {};

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
    const audio = soundCache[name];
    if (!audio) return;
    try {
        audio.currentTime = 0;
        audio.play().catch(() => {});
    } catch (e) {}
}

export function setSoundsEnabled(enabled) {
    soundsEnabled = enabled;
}

export function areSoundsEnabled() {
    return soundsEnabled;
}
