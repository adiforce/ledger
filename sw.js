// 改了任何檔案就把版本號 +1，手機才會抓到新版
const CACHE = 'ledger-v1.18.2';
const ASSETS = ['./', './index.html', './app.js', './manifest.webmanifest', './icon-180.png', './icon-512.png', './lib/sql-wasm.js', './lib/sql-wasm.wasm'];

self.addEventListener('install', (e) => {
  // 新版裝好就直接接手（不用等 App 被完全關閉）；cache:'reload' 避免抓到瀏覽器暫存的舊檔
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((u) => c.add(new Request(u, { cache: 'reload' }))))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

// 快取優先：離線一定打得開；更新靠改 CACHE 版本號
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./index.html').then((r) => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
