// Step Desk — Service Worker
// Bump CACHE_NAME whenever you deploy a new version of index.html
// to force all clients to re-cache.
const CACHE_NAME = 'step-desk-v1';

const ASSETS = [
  './',
  './index.html'
];

// ── Install: pre-cache all assets ────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())   // activate immediately, don't wait
  );
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())  // take control of all open tabs
  );
});

// ── Fetch: cache-first, fall back to network ──────────────────────────────────
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // For external requests (e.g. TAF fetch from aviationweather.gov),
  // go straight to network — don't try to cache them.
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin || event.request.url.startsWith('file://');
  if (!isSameOrigin) {
    event.respondWith(
      fetch(event.request)
        .catch(() => new Response('Offline — external data unavailable.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        }))
    );
    return;
  }

  // For local app assets: cache-first
  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;

        // Not in cache — fetch and cache it for next time
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            const toCache = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
            return response;
          })
          .catch(() => caches.match('./index.html'));  // offline fallback
      })
  );
});
