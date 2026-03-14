const VERSION = "715";
const CACHE_NAME = "nsk-team18-v715";

const ASSETS = [
  "./",
  "./index.html?v=715",
  "./version.js?v=715",
  "./deploy.json?v=715",
  "./app.css?v=715",
  "./config.js?v=715",
  "./auth.js?v=715",
  "./db.js?v=715",
  "./app.js?v=715",
  "./manifest.webmanifest?v=715",
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