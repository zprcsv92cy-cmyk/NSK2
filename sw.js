const VERSION = "717";
const CACHE_NAME = "nsk-team18-v717";

const ASSETS = [
  "./",
  "./index.html?v=717",
  "./version.js?v=717",
  "./deploy.json?v=717",
  "./app.css?v=717",
  "./config.js?v=717",
  "./auth.js?v=717",
  "./db.js?v=717",
  "./app.js?v=717",
  "./manifest.webmanifest?v=717",
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