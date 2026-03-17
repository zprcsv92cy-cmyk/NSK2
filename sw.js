const VERSION = "666";
const CACHE_NAME = "nsk-team18-v666";

const ASSETS = [
  "./",
  "./index.html?v=666",
  "./version.js?v=666",
  "./deploy.json?v=666",
  "./app.css?v=666",
  "./config.js?v=666",
  "./auth.js?v=666",
  "./db.js?v=666",
  "./app.js?v=666",
  "./manifest.webmanifest?v=666",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req);
    })
  );
});