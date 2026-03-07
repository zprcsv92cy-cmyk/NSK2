
const CACHE="nsk-v4"

self.addEventListener("install",e=>{
self.skipWaiting()
e.waitUntil(
caches.open(CACHE).then(c=>c.addAll(["./","index.html","app.js","app.css"]))
)
})

self.addEventListener("fetch",e=>{
e.respondWith(
caches.match(e.request).then(r=>r||fetch(e.request))
)
})
