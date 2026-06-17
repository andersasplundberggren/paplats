/**
 * På plats — Service Worker
 * Placeras i: webapp/pwa/sw.js
 *
 * Tre separata cacher:
 *   paplats-shell-v1  — appskalet (HTML, CSS, JS, config)
 *   paplats-api-v1    — API-svar (kort TTL, network-first)
 *   paplats-media-v1  — bilder och media (cache-first, lång TTL)
 */

const SHELL_CACHE  = 'paplats-shell-v1';
const API_CACHE    = 'paplats-api-v1';
const MEDIA_CACHE  = 'paplats-media-v1';

const SHELL_FILES = [
  '/app/pwa/',
  '/app/pwa/index.html',
  '/app/pwa/app.css',
  '/app/pwa/app.js',
  '/app/pwa/config.js',
];

// ── Install: förcacha appskalet ──────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_FILES))
  );
});

// ── Activate: rensa gamla cacher ─────────────────────────────
self.addEventListener('activate', event => {
  const keep = [SHELL_CACHE, API_CACHE, MEDIA_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch-strategi ───────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skippa icke-GET
  if (request.method !== 'GET') return;

  // API — network-first, fallback till cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  // Media — cache-first
  if (url.pathname.startsWith('/media/') || url.pathname.startsWith('/uploads/')) {
    event.respondWith(cacheFirstMedia(request));
    return;
  }

  // Appskalet — cache-first
  if (SHELL_FILES.some(f => url.pathname === f || url.pathname.endsWith(f.replace('/app/pwa', '')))) {
    event.respondWith(cacheFirstShell(request));
    return;
  }
});

async function networkFirstApi(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirstMedia(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(MEDIA_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

async function cacheFirstShell(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  return fetch(request);
}