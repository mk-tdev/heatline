// Cache only the self-contained worker replay. No worker input enters this cache.
const cacheName = 'heatline-worker-shell-v1';
const shell = '/worker/index.html';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.add(new Request(shell, {cache: 'reload'}));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.mode !== 'navigate' || url.origin !== self.location.origin ||
      !['/worker/', shell].includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(shell)) || fetch(event.request);
  })());
});
