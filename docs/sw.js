// build-20260104-162844
const KGB_CACHE = "kgb-cache-build-20260104-162844";
self.addEventListener("install", (e) => {
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    // delete all old caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (e) => {
  // Network-first voor html/js/css zodat updates altijd doorkomen
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET") return;

  const isAsset = url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.endsWith(".html");
  if (isAsset) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: "no-store" });
        return fresh;
      } catch (err) {
        return fetch(req);
      }
    })());
    return;
  }

  // default: pass-through
});
