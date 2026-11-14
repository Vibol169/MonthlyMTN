const CACHE_NAME = 'project2-cache-v11';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './gas-api.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => { if (key !== CACHE_NAME) return caches.delete(key); })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Network First, fallback to Cache for HTML/JSON API
  if (e.request.method === 'POST') return; // Don't cache API POSTs
  
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', function(e) {
  if (!(self.Notification && self.Notification.permission === 'granted')) {
    return;
  }

  let data = { title: 'New Notification', body: 'You have a new message.' };
  if (e.data) {
    try { data = e.data.json(); } catch (err) { data.body = e.data.text(); }
  }

  const options = {
    body: data.body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    data: { url: data.url || './index.html' }
  };

  e.waitUntil(self.registration.showNotification(data.title, options));
});

// Open app when notification is clicked
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data.url));
});

