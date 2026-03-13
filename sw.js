const VERSION = "706";
const CACHE_NAME = "nsk-team18-v706";

const ASSETS = [
  "./",
  "./index.html?v=706",
  "./version.js?v=706",
  "./deploy.json?v=706",
  "./app.css?v=706",
  "./config.js?v=706",
  "./auth.js?v=706",
  "./login-patch.js?v=706",
  "./db.js?v=706",
  "./app.js?v=706",
  "./manifest.webmanifest?v=706",
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