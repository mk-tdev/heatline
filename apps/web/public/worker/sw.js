importScripts('/worker/outbox.js');
const cacheName = 'heatline-worker-shell-v3';
const shell = '/worker/index.html';
const assets = [shell, '/worker/outbox.js', '/worker/room.js'];
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName);
  await cache.addAll(assets.map(url => new Request(url, {cache:'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith('heatline-worker-shell-') && key !== cacheName) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  const path = url.pathname === '/worker/' ? shell : url.pathname;
  // Offline first, but refresh the copy in the background when online, so updates reach phones.
  if (assets.includes(path)) event.respondWith(caches.open(cacheName).then(async cache => {
    const cached = await cache.match(path);
    const fresh = fetch(new Request(path, {cache:'reload'})).then(r => { if (r.ok) cache.put(path, r.clone()); return r; });
    if (cached) { event.waitUntil(fresh.catch(() => {})); return cached; }
    return fresh;
  }));
});
self.addEventListener('sync', event => {
  if (event.tag === 'shade-receipts') event.waitUntil(flushReceipts());
});
