const VERSION = "701";
const CACHE_NAME = `nsk-team18-v${VERSION}`;
const ASSETS = [
  "./",
  "./index.html",
  "./startsida/",
  "./truppen/",
  "./skapapoolspel/",
  "./lag/",
  "./laguppstallning/",
  "./bytesschema/",
  "./malvaktsstatistik/",
  "./matchvy/",
  "./version.js?v=701",
  "./deploy.json?v=701",
  "./config.js?v=701",
  "./app.css?v=701",
  "./auth.js?v=701",
  "./login-patch.js?v=701",
  "./db.js?v=701",
  "./app.js?v=701",
  "./manifest.webmanifest?v=701",
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
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return caches.match("./index.html", { ignoreSearch: true }) || Response.error();
    }
  })());
});
