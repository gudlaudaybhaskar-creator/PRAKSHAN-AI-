// Prakashan AI - Resilient Offline Service Worker for APK & PWA
const CACHE_NAME = 'prakashan-ai-v2';
const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './logo.jpg',
  './manifest.json'
];

const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Core local assets
      await cache.addAll(CORE_ASSETS).catch(err => console.warn("Core cache note:", err));
      // External CDN assets (attempt gracefully without breaking if offline)
      for (const url of EXTERNAL_ASSETS) {
        try {
          await cache.add(url);
        } catch (e) {
          console.warn("External asset cache note:", url, e);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      return fetch(event.request).catch(() => caches.match('./index.html'));
    })
  );
});
