// BOTWAVEBOMBA Service Worker
// App shell: cache-first. API JSON: stale-while-revalidate.

const CACHE_VERSION = 'bwb-v1';

const APP_SHELL = [
  '/botwavebomba/',
  '/botwavebomba/index.html',
  '/botwavebomba/blindspots.html',
  '/botwavebomba/sources.html',
  '/botwavebomba/about.html',
  '/botwavebomba/story.html',
  '/botwavebomba/funnies.html',
  '/botwavebomba/assets/css/main.css',
  '/botwavebomba/assets/css/funnies.css',
  '/botwavebomba/assets/js/api.js',
  '/botwavebomba/assets/js/feed.js',
  '/botwavebomba/assets/js/blindspot.js',
  '/botwavebomba/assets/js/sources.js',
  '/botwavebomba/assets/js/story.js',
  '/botwavebomba/assets/js/heatmap.js',
  '/botwavebomba/assets/js/funnies.js',
  '/botwavebomba/assets/js/theme-switcher.js',
  '/botwavebomba/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API JSON — stale-while-revalidate
  if (url.pathname.includes('/botwavebomba/api/')) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async cache => {
        const cached = await cache.match(event.request);
        const fetchPromise = fetch(event.request).then(response => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Source registry data — cache-first
  if (url.pathname.includes('/botwavebomba/data/')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(CACHE_VERSION).then(c => c.put(event.request, response.clone()));
          }
          return response;
        });
      })
    );
    return;
  }

  // App shell — cache-first, fall back to network
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
