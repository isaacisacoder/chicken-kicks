/* Locally supplied game files never leave this browser. No network fallback. */
const base = new URL('./', self.location.href).pathname;
const CACHE = 'chicken-kicks-local-resources-v1:' + base;
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(base + '__local/')) return;
  event.respondWith((async () => {
    if (event.request.method !== 'GET') return new Response('', {status: 405});
    const cache = await caches.open(CACHE);
    return await cache.match(url.origin + url.pathname) || new Response('Select your local resource folder.', {
      status: 404, headers: {'Content-Type': 'text/plain', 'Cache-Control': 'no-store'},
    });
  })());
});
