const CACHE_NAME = 'paperclip-factory-v1';
const ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/styles.css',
    './js/main.js',
    './js/config.js',
    './js/state.js',
    './js/audio.js',
    './js/effects.js',
    './js/save.js',
    './js/achievements.js',
    './js/production.js',
    './js/upgrades.js',
    './js/events.js',
    './js/ui.js',
    './js/game-loop.js',
    './assets/images/background.webp',
    './assets/images/trophy-bronze.png',
    './assets/images/trophy-silver.png',
    './assets/images/trophy-gold.png',
    './assets/audio/click.mp3',
    './assets/audio/cash.mp3',
    './assets/audio/buy.mp3',
    './assets/audio/Trophy.mp3',
    './assets/audio/warning.mp3',
    './assets/audio/fire.mp3',
    './assets/audio/fail.mp3',
    './assets/audio/completion.mp3',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)),
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
            ),
        ),
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const cloned = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
                return response;
            }).catch(() => caches.match('./index.html'));
        }),
    );
});
