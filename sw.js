const VERSION = "700";
const CACHE_NAME = `nsk-team18-v${VERSION}`;
const ASSETS = [
  "./",
  "./index.html?v=700",
  "./version.js?v=700",
  "./deploy.json?v=700",
  "./config.js?v=700",
  "./app.css?v=700",
  "./auth.js?v=700",
  "./login-patch.js?v=700",
  "./db.js?v=700",
  "./app.js?v=700",
  "./manifest.webmanifest?v=700",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: false });
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return caches.match("./index.html?v=700") || Response.error();
    }
  })());
});
