importScripts('/worker/outbox.js');
const cacheName = 'heatline-worker-shell-v2';
const shell = '/worker/index.html';
const assets = [shell, '/worker/outbox.js', '/worker/room.js'];
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName);
  await cache.addAll(assets.map(url => new Request(url, {cache:'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await caches.delete('heatline-worker-shell-v1');
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  const path = url.pathname === '/worker/' ? shell : url.pathname;
  if (assets.includes(path)) event.respondWith(caches.open(cacheName).then(async cache =>
    (await cache.match(path)) || fetch(event.request)));
});
self.addEventListener('sync', event => {
  if (event.tag === 'shade-receipts') event.waitUntil(flushReceipts());
});
