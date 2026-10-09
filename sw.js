const CACHE_VERSION = 'mahjong-dj-mainlux-icons-2026-10-09';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/backgrounds/bg-main.jpg',
  './assets/backgrounds/bg-lobby.jpg',
  './assets/backgrounds/bg-game.jpg',
  './assets/backgrounds/bg-ai-card.jpg',
  './assets/backgrounds/bg-avatar.jpg',
  './assets/backgrounds/bg-multiplayer-card.jpg',
  './assets/backgrounds/bg-play.jpg',
  './assets/backgrounds/bg-result.jpg',
  './assets/backgrounds/bg-settings.jpg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/js/00-game-core.js',
  './assets/js/01-portrait-runtime.js',
  './assets/js/02-game-language-runtime.js',
  './assets/css/00-base-inline.css',
  './assets/css/01-ui-polish.css',
  './assets/css/02-portrait-playability.css',
  './assets/css/03-multiplayer-chat.css',
  './assets/css/04-custom-profile-style.css',
  './assets/css/05-premium-action.css',
  './assets/css/06-game-language.css',
  './assets/css/07-v26-features.css',
  './assets/js/03-v26-features.js',
  './assets/css/08-main-menu-theme.css',
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
