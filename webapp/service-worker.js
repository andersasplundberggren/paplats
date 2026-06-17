// ─── Version — byt detta nummer vid varje driftsättning ──────
const VERSION = 'v12';
const CACHE_NAME = `spoton-shell-${VERSION}`;

const APP_SHELL_URLS = [
  '/app/',
  '/app/index.html',
  '/app/app.css',
  '/app/app.js',
  '/app/config.js',
  '/app/tour.js',
  '/app/tour.css',
  '/app/app.webmanifest',
  '/app/icons/icon-192.png',
  '/app/icons/icon-512.png'
];

// ─── Install — cacha shell-filer ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  // Vänta — skipWaiting anropas bara när appen ber om det
});

// ─── Activate — rensa gamla cachar ───────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Meddelanden från appen ───────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Fetch — network-first med cache-fallback ─────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/app')) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === 'navigate') {
          const fallback = await caches.match('/app/index.html');
          if (fallback) return fallback;
        }

        throw new Error('Ingen cachead resurs tillgänglig.');
      })
  );
});