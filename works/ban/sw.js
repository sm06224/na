/* ============================================================
   Service Worker — 番をオフラインでも開けるようにする。
   シフト作成は電波の悪いバックヤードでも行われるので。
   方針: アプリの殻は cache-first、見つからなければネットへ。
   ============================================================ */

const VERSION = 'ban-v1';
const SHELL = [
  './',
  './index.html',
  './help.html',
  './style.css',
  './manifest.json',
  './icon.svg',
  './js/ui/main.js',
  './js/ui/dom.js',
  './js/ui/grid.js',
  './js/ui/staffPanel.js',
  './js/ui/shiftPanel.js',
  './js/ui/rulesPanel.js',
  './js/ui/statsPanel.js',
  './js/ui/violationsPanel.js',
  './js/core/rng.js',
  './js/core/time.js',
  './js/core/model.js',
  './js/core/rules.js',
  './js/core/validate.js',
  './js/core/solver.js',
  './js/core/csv.js',
  './js/core/ical.js',
  './js/core/store.js',
  './js/core/demo.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(hit =>
      hit || fetch(e.request).then(res => {
        // 取れたものはキャッシュに足しておく（次のオフラインに備える）
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit)
    )
  );
});
