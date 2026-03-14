const VERSION = "718";
const CACHE_NAME = "nsk-team18-v718";

const ASSETS = [
  "./",
  "./index.html?v=718",
  "./version.js?v=718",
  "./deploy.json?v=718",
  "./app.css?v=718",
  "./config.js?v=718",
  "./auth.js?v=718",
  "./db.js?v=718",
  "./app.js?v=718",
  "./manifest.webmanifest?v=718",
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