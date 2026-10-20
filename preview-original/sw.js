const offlineCache = 'hooper-navi-offline-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(offlineCache).then(cache => cache.add(new Request('/offline.html', {cache:'reload'}))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('hooper-navi-offline-') && key !== offlineCache).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Only the public home document gets an offline fallback. APIs and private tools always use the network.
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || url.origin !== self.location.origin || !['/', '/index.html'].includes(url.pathname)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.status >= 500) throw Error('Unavailable');
    return response;
  }).catch(() => caches.open(offlineCache).then(cache => cache.match('/offline.html'))));
});
