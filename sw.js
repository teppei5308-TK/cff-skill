// 画面の部品だけを端末に置く（データと動画は毎回取りに行く）。通信が切れても最後に開いた画面は出る
const CACHE = 'cff-skill-2026-11-09a';
const SHELL = ['./', './index.html', './app.css?v=2026-11-09a', './app.js?v=2026-11-09a', './seed.js?v=2026-11-09a',
  './icons/cr-logo.png', './icons/cr-logo-white.png', './icons/app-icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('./index.html'))));
});
