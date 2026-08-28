const CACHE_VERSION = 'mahjong-soul-p2p-v11-2026-08-28';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_SHELL).catch(()=>{}))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_VERSION).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', event => {
  const req=event.request; if(req.method!=='GET') return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{const cp=res.clone();caches.open(CACHE_VERSION).then(c=>c.put(req,cp));return res;}).catch(()=>caches.match(req).then(x=>x||caches.match('./')))); return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{const cp=res.clone();caches.open(CACHE_VERSION).then(c=>c.put(req,cp));return res;})));
});
