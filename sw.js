const VERSION = "727";
const CACHE_NAME = "nsk-team18-v727";

const ASSETS = [
  "./",
  "./index.html?v=727",
  "./version.js?v=727",
  "./deploy.json?v=727",
  "./app.css?v=727",
  "./config.js?v=727",
  "./auth.js?v=727",
  "./db.js?v=727",
  "./app.js?v=727",
  "./manifest.webmanifest?v=727",
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