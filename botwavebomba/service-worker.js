// BOTWAVEBOMBA Service Worker
// App shell: cache-first. API JSON: stale-while-revalidate.
// v2 (2026-05-10): adds post-sprint audit surface to offline cache so the
// TWA APK ships with status.html, pipeline_state.json, and the diagnostic
// docs accessible without network. BE UNDENIABLE — claims auditable even
// when offline.

const CACHE_VERSION = 'bwb-v6-2026-07-08-subpath';

// Derive base path from this SW's own URL. On canonical (Cloudflare Pages) the
// SW is served from /service-worker.js, so SW_BASE === ''. On the umbrella
// GitHub Pages mirror the SW is at /botwavebomba/service-worker.js, so
// SW_BASE === '/botwavebomba'. Every APP_SHELL entry is then prefixed with the
// actual base path, so precache installs succeed on both deployments.
const SW_URL = self.location.pathname;
const SW_BASE = SW_URL.endsWith('/service-worker.js')
  ? SW_URL.slice(0, -'/service-worker.js'.length)
  : SW_URL.replace(/\/service-worker\.js$/, '');
const ASSET = (p) => SW_BASE + p;

const APP_SHELL = [
  '/',
  '/index.html',
  '/blindspots.html',
  '/sources.html',
  '/about.html',
  '/story.html',
  '/funnies.html',
  '/status.html',
  '/pipeline_state.json',
  '/DIAGNOSTIC.md',
  '/PLAN_HYBRID.md',
  '/assets/css/main.css',
  '/assets/css/mobile.css',
  '/assets/css/funnies.css',
  '/assets/js/api.js',
  '/assets/js/feed.js',
  '/assets/js/blindspot.js',
  '/assets/js/sources.js',
  '/assets/js/story.js',
  '/assets/js/heatmap.js',
  '/assets/js/funnies.js',
  '/assets/js/theme-switcher.js',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/manifest.json',
].map(ASSET);

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
  if (url.pathname.includes('/api/')) {
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
  if (url.pathname.includes('/data/')) {
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
          caches.match(ASSET('/index.html'))
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
