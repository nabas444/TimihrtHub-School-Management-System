// ─────────────────────────────────────────────────────────────────────────────
// TimhirtHub service worker — Phase 3 (PWA & Offline-First)
//
// Hand-rolled rather than built with vite-plugin-pwa: this session's sandbox
// had no network access to verify a new build-time dependency actually
// installs and produces a working output, so a plain, dependency-free service
// worker was the safer choice. A future session with real npm access could
// swap this for vite-plugin-pwa/Workbox without changing the app's behavior.
//
// Strategies:
//  - App shell (HTML/CSS/JS/icons): cache-first, falling back to network,
//    so the app still loads with no connection at all.
//  - GET /api/v1/academics/results* (grade views): stale-while-revalidate —
//    serve the last-cached response immediately if offline or slow, and
//    refresh the cache in the background when online. This is what lets a
//    student/parent view already-fetched grades offline, per the
//    requirement document.
//  - Everything else (writes, other API calls): network-only, untouched —
//    offline *writes* (e.g. marking attendance) are handled separately by
//    the IndexedDB queue in src/lib/offlineQueue.js, not by this cache.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'timhirthub-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL_URLS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

// Paths matched against pathname (query string ignored) for the
// stale-while-revalidate "view already-fetched data offline" behaviour.
const READ_THROUGH_CACHE_PATTERNS = [
  '/api/v1/academics/results',
  '/api/v1/academics/reports',
  '/api/v1/schools/dashboard',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .catch((err) => {
        // Don't fail install over one missing asset (e.g. a dev-mode 404) —
        // an app shell with 4/5 assets cached is still far better than none.
        console.warn('[sw] app shell precache had an issue', err);
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('timhirthub-') && key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      ),
    ).then(() => self.clients.claim()),
  );
});

function isReadThroughApiRequest(url) {
  return READ_THROUGH_CACHE_PATTERNS.some((p) => url.pathname.startsWith(p));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // writes are never intercepted here

  const url = new URL(request.url);

  // Read-through cache for grade/report/dashboard GETs.
  if (url.origin === self.location.origin && isReadThroughApiRequest(url)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached); // offline — fall back to whatever we have cached
        return cached || networkFetch;
      }),
    );
    return;
  }

  // App shell / static assets: cache-first, network fallback, cache the result.
  if (url.origin === self.location.origin && !url.pathname.startsWith('/api')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.ok && (request.destination === 'script' || request.destination === 'style' || request.destination === 'image' || request.destination === 'document')) {
              const clone = response.clone();
              caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => caches.match('/')); // last resort: serve the app shell so the SPA router can take over
      }),
    );
  }
  // Everything else (other API GETs) — let the browser handle it untouched.
});
