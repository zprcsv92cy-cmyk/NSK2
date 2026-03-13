const VERSION = "701";
const CACHE_NAME = "nsk-team18-v701";
const ASSETS = [
  "./",
  "./index.html?v=701",
  "./version.js?v=701",
  "./deploy.json?v=701",
  "./app.css?v=701",
  "./config.js?v=701",
  "./auth.js?v=701",
  "./login-patch.js?v=701",
  "./db.js?v=701",
  "./app.js?v=701",
  "./manifest.webmanifest?v=701",
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
