// 20260104-163857
self.addEventListener("install", (e) => {
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (e) => {
  // network-first voor alles
  e.respondWith((async () => {
    try {
      return await fetch(e.request, { cache: "no-store" });
    } catch (err) {
      return fetch(e.request);
    }
  })());
});
