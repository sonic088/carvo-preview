// CARVO PWA service worker: network-first with cache fallback (offline support).
const CACHE = 'carvo-v172'; // bump to force clients to drop old caches
const CORE = ['./', 'index.html', 'manifest.json', 'flutter_bootstrap.js', 'main.dart.js', 'favicon.png', 'icons/Icon-192.png', 'splash/splash_bg.jpg', 'splash/splash_wordmark.png', 'splash/splash_tagline.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Media goes straight to the network: iOS Safari streams video with Range requests (206), which a SW fetch +
  // cache.put would turn into whole-file copies in memory (and cache.put rejects 206).
  if (req.headers.has('range') || /\.(mp4|m4v|mov|webm|m3u8|ts)$/i.test(url.pathname)) return;
  event.respondWith(
    fetch(req, { cache: 'no-cache' }) // always revalidate with the server so new builds show up on reload
      .then((res) => {
        if (res.ok && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      // only page loads fall back to index.html; a failed font/asset must not be answered with HTML
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
