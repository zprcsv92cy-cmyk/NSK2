const VERSION = "722";
const CACHE_NAME = "nsk-team18-v722";

const ASSETS = [
  "./",
  "./index.html?v=722",
  "./version.js?v=722",
  "./deploy.json?v=722",
  "./app.css?v=722",
  "./config.js?v=722",
  "./auth.js?v=722",
  "./db.js?v=722",
  "./app.js?v=722",
  "./manifest.webmanifest?v=722",
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