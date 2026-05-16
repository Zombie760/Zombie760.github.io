// BOTWAVEBOMBA Service Worker
// App shell: cache-first. API JSON: stale-while-revalidate.
// v2 (2026-05-10): adds post-sprint audit surface to offline cache so the
// TWA APK ships with status.html, pipeline_state.json, and the diagnostic
// docs accessible without network. BE UNDENIABLE — claims auditable even
// when offline.

const CACHE_VERSION = 'bwb-v3-mobile';

const APP_SHELL = [
  '/botwavebomba/',
  '/botwavebomba/index.html',
  '/botwavebomba/blindspots.html',
  '/botwavebomba/sources.html',
  '/botwavebomba/about.html',
  '/botwavebomba/story.html',
  '/botwavebomba/funnies.html',
  '/botwavebomba/status.html',
  '/botwavebomba/pipeline_state.json',
  '/botwavebomba/DIAGNOSTIC.md',
  '/botwavebomba/PLAN_HYBRID.md',
  '/botwavebomba/assets/css/main.css',
  '/botwavebomba/assets/css/mobile.css',
  '/botwavebomba/assets/css/funnies.css',
  '/botwavebomba/assets/js/api.js',
  '/botwavebomba/assets/js/feed.js',
  '/botwavebomba/assets/js/blindspot.js',
  '/botwavebomba/assets/js/sources.js',
  '/botwavebomba/assets/js/story.js',
  '/botwavebomba/assets/js/heatmap.js',
  '/botwavebomba/assets/js/funnies.js',
  '/botwavebomba/assets/js/theme-switcher.js',
  '/botwavebomba/assets/icons/icon-192.png',
  '/botwavebomba/assets/icons/icon-512.png',
  '/botwavebomba/manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      // Per-URL add() with catch so one 404 doesn't poison the install.
      // The TWA install on a fresh device must succeed even if a doc URL
      // is briefly unavailable; offline degradation is acceptable, install
      // failure is not.
      Promise.all(APP_SHELL.map(url =>
        cache.add(url).catch(err => {
          console.warn('[bwb-sw] precache miss', url, err);
        })
      ))
    )
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

  // Navigation requests (TWA opens these): cache-first, network fallback,
  // offline fallback to index.html so the app shell renders even on a
  // freshly-opened airplane-mode device.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request).then(cached =>
        cached || fetch(event.request).catch(() =>
          caches.match('/botwavebomba/index.html')
        )
      )
    );
    return;
  }

  // App shell — cache-first, fall back to network.
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
