/* =========================================================
   PE Checklist service worker
   - Keeps the app installable and handles Web Push.
   - NEVER serves an old app.js when the network is available.
   - Clears previous cache versions on activate, so a stale build cannot
     keep showing the old checklist/header code.
   ========================================================= */
const SW_VERSION = '20261127g';
const CACHE_NAME = 'pe-checklist-shell-' + SW_VERSION;
const SHELL = [
  './',
  './index.html',
  './syles.css',
  './gas-api.js?v=20261127c',
  './app.js?v=20261127g'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(SHELL.map(url =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
      ))
    )
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw err;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // API calls (Cloudflare worker), Google, CDNs: leave them to the network.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw-project2.js')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }

  if (/\.(?:html|js|css)$/i.test(url.pathname) || url.pathname.endsWith('/')) {
    event.respondWith(networkFirst(request));
  }
});

/* ---------------- Web Push ---------------- */
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'PE Checklist';
  const options = {
    body: data.body || '',
    data: { url: data.url || './' },
    tag: 'pe-checklist',
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || './',
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) {
          return client.navigate(target).then(c => c && c.focus()).catch(() => client.focus());
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
