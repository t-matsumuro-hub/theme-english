/* テーマ英語 - Service Worker
   学習中は一切通信しない（cache-only）。テーマパックは IndexedDB に入っているので
   アプリ本体のファイルだけをキャッシュする。
   更新は VERSION を上げた sw.js が配信されたときにだけ行う。 */

const VERSION = 'v0.1.0';
const CACHE = `theme-english-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/srs.js',
  './js/store.js',
  './js/tts.js',
  './js/ui/common.js',
  './js/ui/router.js',
  './js/ui/home.js',
  './js/ui/article.js',
  './js/ui/items.js',
  './js/ui/quiz.js',
  './js/ui/write.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await Promise.all(SHELL.map((u) => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/packs/')) return; // 開発用のパック読み込みはキャッシュしない

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch {
      if (req.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      return new Response('オフラインです', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
