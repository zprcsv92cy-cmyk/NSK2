const VERSION = "702";
const CACHE_NAME = "nsk-team18-v702";
const ASSETS = [
  "./",
  "./index.html?v=702",
  "./version.js?v=702",
  "./deploy.json?v=702",
  "./app.css?v=702",
  "./config.js?v=702",
  "./auth.js?v=702",
  "./login-patch.js?v=702",
  "./db.js?v=702",
  "./app.js?v=702",
  "./manifest.webmanifest?v=702",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, fresh.clone());
    return fresh;
  })());
});
