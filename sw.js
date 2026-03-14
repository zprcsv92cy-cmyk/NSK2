const VERSION = "726";
const CACHE_NAME = "nsk-team18-v726";

const ASSETS = [
  "./",
  "./index.html?v=726",
  "./version.js?v=726",
  "./deploy.json?v=726",
  "./app.css?v=726",
  "./config.js?v=726",
  "./auth.js?v=726",
  "./db.js?v=726",
  "./app.js?v=726",
  "./manifest.webmanifest?v=726",
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