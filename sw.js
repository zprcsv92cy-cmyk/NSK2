const VERSION = "701";
const CACHE_NAME = "nsk-team18-v701";

const ASSETS = [
  "./",
  "./index.html?v=701",
  "./version.js?v=701",
  "./deploy.json?v=701",
  "./app.css?v=701",
  "./config.js?v=701",
  "./auth.js?v=701",
  "./login-patch.js?v=701",
  "./db.js?v=701",
  "./app.js?v=701",
  "./manifest.webmanifest?v=701",
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