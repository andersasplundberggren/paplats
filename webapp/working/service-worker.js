// ─── Cache-namn ───────────────────────────────────────────────
// Öka versionsnumret här om app-skalet ändras (tvingar ominstallation)
const SHELL_CACHE   = 'spoton-shell-v2';
const API_CACHE     = 'spoton-api-v1';
const MEDIA_CACHE   = 'spoton-media-v1';

const APP_SHELL_URLS = [
  '/app/',
  '/app/index.html',
  '/app/app.css',
  '/app/app.js',
  '/app/config.js',
  '/app/app.webmanifest',
  '/app/icons/icon-192.png',
  '/app/icons/icon-512.png'
];

// ─── Install: förcacha app-skalet ────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  self.skipWaiting();
});

// ─── Activate: rensa gamla cacher ────────────────────────────
self.addEventListener('activate', (event) => {
  const validCaches = [SHELL_CACHE, API_CACHE, MEDIA_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !validCaches.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Mediafiler — cache-first, network-fallback
  //    Bilder och ljud cachas permanent när de laddas första gången.
  if (url.pathname.startsWith('/media/')) {
    event.respondWith(cacheFirstMedia(request));
    return;
  }

  // 2. API-anrop för uppdragsdata — network-first, cache-fallback
  //    Cachar det senaste svaret. Används om nätverket tappas.
  if (url.pathname.startsWith('/api/v1/assignments/')) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  // 3. App-skal — network-first, cache-fallback (befintlig logik)
  if (url.pathname.startsWith('/app')) {
    event.respondWith(networkFirstShell(request));
    return;
  }

  // Övrigt — låt nätverket hantera det
});

// ─── Strategi: cache-first för media ─────────────────────────
async function cacheFirstMedia(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(MEDIA_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    throw new Error('Mediafilen kunde inte laddas och finns inte i cache.');
  }
}

// ─── Strategi: network-first för API ─────────────────────────
async function networkFirstApi(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Nätverket otillgängligt — försök med cache
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('API-data saknas och nätverket är otillgängligt.');
  }
}

// ─── Strategi: network-first för app-skalet ──────────────────
async function networkFirstShell(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const fallback = await caches.match('/app/index.html');
      if (fallback) return fallback;
    }

    throw new Error('Ingen cachead resurs tillgänglig.');
  }
}