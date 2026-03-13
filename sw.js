const VERSION = "701";
const CACHE_NAME = `nsk-team18-v${VERSION}`;
const ASSETS = [
  "./",
  `./index.html?v=${VERSION}`,
  `./version.js?v=${VERSION}`,
  `./deploy.json?v=${VERSION}`,
  `./app.css?v=${VERSION}`,
  `./config.js?v=${VERSION}`,
  `./auth.js?v=${VERSION}`,
  `./login-patch.js?v=${VERSION}`,
  `./db.js?v=${VERSION}`,
  `./app.js?v=${VERSION}`,
  `./manifest.webmanifest?v=${VERSION}`,
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

  const url = new URL(req.url);
  const isVersionPing = url.pathname.endsWith("/deploy.json") || url.pathname.endsWith("deploy.json");

  if (isVersionPing) {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match(req)));
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(req, fresh.clone());
    }
    return fresh;
  })());
});
