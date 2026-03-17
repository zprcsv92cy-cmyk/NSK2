const VERSION = "665";
const CACHE_NAME = "nsk-team18-v665";

const ASSETS = [
  "./",
  "./index.html?v=665",
  "./version.js?v=665",
  "./deploy.json?v=665",
  "./app.css?v=665",
  "./config.js?v=665",
  "./auth.js?v=665",
  "./db.js?v=665",
  "./app.js?v=665",
  "./manifest.webmanifest?v=665",
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