/* 狐の留守番 — 電波があるときは常に最新を取り、控えを更新する。
   電波が絶えたときだけ、控えが狩りを支える。
   （針の v1 で学んだ：キャッシュ優先は、直した版を閉め出す檻になる。
   だから初めから network-first。） */

const CACHE = 'kitsune-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icon.svg',
  './icon-180.png',
  './js/core/geo.js',
  './js/core/course.js',
  './js/core/qr.js',
  './js/ui/main.js',
  './js/ui/needle.js',
  './js/ui/sensors.js',
  './js/ui/camera.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() =>
      caches.match(e.request, { ignoreSearch: true })
        .then(hit => hit ?? caches.match('./index.html'))));
});
