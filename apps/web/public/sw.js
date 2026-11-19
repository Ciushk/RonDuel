const CACHE_NAME = 'ronduel-shell-v1';
const SHELL_URLS = ['/offline', '/brand/icon.svg', '/brand/icon-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
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
  const url = new URL(event.request.url);

  // Never cache game APIs, questions, or answers
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Navigation requests: network first, fallback to /offline
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline')));
    return;
  }

  // Static assets: stale-while-revalidate
  if (url.pathname.startsWith('/brand/') || url.pathname.startsWith('/_next/static/')) {
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
