const BUILD_ID = '__RONDUEL_BUILD_ID__';
const CACHE_NAME = `ronduel-shell-${BUILD_ID}`;
const SHELL_URLS = ['/offline', '/brand/icon.svg', '/brand/icon-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)));
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (
    data === 'SKIP_WAITING' ||
    (data && typeof data === 'object' && data.type === 'SKIP_WAITING')
  ) {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache game APIs, questions, answers, service worker, or build manifest
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/sw.js' ||
    url.pathname === '/version.json'
  ) {
    return;
  }

  // Navigation requests: network first, fallback to /offline
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline')));
    return;
  }

  // Content-hashed immutable Next.js assets: cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((res) => {
            if (res.ok) cache.put(event.request, res.clone());
            return res;
          });
        }),
      ),
    );
    return;
  }

  // Brand and RonTown sprites (cache-busted via ?v=BUILD_ID): stale-while-revalidate
  if (url.pathname.startsWith('/brand/') || url.pathname.startsWith('/rontown/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const networkPromise = fetch(event.request)
            .then((res) => {
              if (res.ok) cache.put(event.request, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || networkPromise;
        }),
      ),
    );
  }
});

self.addEventListener('push', (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch {
    p = {};
  }
  const d = p.data || p;
  const n = p.notification || {};
  const title = d.title || n.title || 'RonDuel';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || n.body || '',
      icon: '/brand/icon-192.png',
      badge: '/brand/icon-monochrome.svg',
      tag: d.tag || 'ronduel',
      data: { url: d.url || '/' },
      renotify: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin)) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
