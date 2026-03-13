const CACHE_NAME="nsk-team18-v75";
const ASSETS=["./","./index.html","./config.js?v=75","./app.css?v=75","./auth.js?v=75","./db.js?v=75","./app.js?v=75","./manifest.webmanifest","./icon-192.png","./icon-512.png"];
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).catch(()=>{}));});
self.addEventListener("activate",e=>{e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))),self.clients.claim()]));});
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET") return;
  event.respondWith((async()=>{
    const cached=await caches.match(req);
    if(cached) return cached;
    const fresh=await fetch(req);
    const cache=await caches.open(CACHE_NAME);
    cache.put(req,fresh.clone());
    return fresh;
  })());
});
