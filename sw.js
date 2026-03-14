const VERSION = "721";
const CACHE_NAME = "nsk-team18-v721";

const ASSETS = [
  "./",
  "./index.html?v=721",
  "./version.js?v=721",
  "./deploy.json?v=721",
  "./app.css?v=721",
  "./config.js?v=721",
  "./auth.js?v=721",
  "./db.js?v=721",
  "./app.js?v=721",
  "./manifest.webmanifest?v=721",
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