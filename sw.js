const VERSION = "704";
const CACHE_NAME = "nsk-team18-v704";

const ASSETS = [
  "./",
  "./index.html?v=704",
  "./version.js?v=704",
  "./deploy.json?v=704",
  "./app.css?v=704",
  "./config.js?v=704",
  "./auth.js?v=704",
  "./login-patch.js?v=704",
  "./db.js?v=704",
  "./app.js?v=704",
  "./manifest.webmanifest?v=704",
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