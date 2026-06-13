/* 狐の留守番 — 電波があるときは常に最新を取り、控えを更新する。
   電波が絶えたときだけ、控えが狩りを支える。

   学び：network-first でも fetch(e.request) は既定でブラウザの HTTP
   キャッシュを使うので、GitHub Pages の max-age が切れるまで古い版が
   返ってしまう（直したのに黒画面のまま、の正体）。だから取得は必ず
   HTTP キャッシュを迂回（no-store）し、控えはこの SW 自身が持つ。 */

const CACHE = 'kitsune-v2';
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
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'no-store' }))))
      .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()));
});

/* HTTP キャッシュを迂回して網から取り、控えを更新。失敗したら控えで支える。 */
function fresh(request) {
  const url = new URL(request.url);
  return fetch(new Request(url, { cache: 'no-store', credentials: 'same-origin' }));
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    fresh(e.request).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() =>
      caches.match(e.request, { ignoreSearch: true })
        .then(hit => hit ?? caches.match('./index.html'))));
});
