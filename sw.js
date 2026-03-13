const VERSION = "705";
const CACHE_NAME = "nsk-team18-v705";

const ASSETS = [
  "./",
  "./index.html?v=705",
  "./version.js?v=705",
  "./deploy.json?v=705",
  "./app.css?v=705",
  "./config.js?v=705",
  "./auth.js?v=705",
  "./login-patch.js?v=705",
  "./db.js?v=705",
  "./app.js?v=705",
  "./manifest.webmanifest?v=705",
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