const VERSION = "659";
const CACHE_NAME = "nsk-team18-v659";

const ASSETS = [
  "./",
  "./index.html?v=659",
  "./version.js?v=659",
  "./deploy.json?v=659",
  "./app.css?v=659",
  "./config.js?v=659",
  "./auth.js?v=659",
  "./db.js?v=659",
  "./app.js?v=659",
  "./manifest.webmanifest?v=659",
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