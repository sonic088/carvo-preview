// CARVO PWA service worker: network-first with cache fallback (offline support).
const CACHE = 'carvo-v184'; // bump to force clients to drop old caches
const CORE = ['./', 'index.html', 'manifest.json', 'flutter_bootstrap.js', 'main.dart.js', 'favicon.png', 'icons/Icon-192.png', 'splash/splash_bg.jpg', 'splash/splash_wordmark.png', 'splash/splash_tagline.png'];

const IMG = 'carvo-img-v1', IMG_MAX = 400; // ~400 WebP renditions (~15-70 KB each) <= ~20 MB
const API = 'carvo-api-v1', API_MAX = 120;
const IMG_ORIGIN = 'https://carvo-img.abdeslam-gh17.workers.dev';
const API_ORIGIN = 'https://carvo-products.abdeslam-gh17.workers.dev';
const SWR = /^\/v1\/(categories(\/.*)?|search(\/(trending|suggest|filters))?)$/;

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]); // oldest first (insertion order)
}

async function cacheFirst(req) {
  const c = await caches.open(IMG);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) { await c.put(req, res.clone()).catch(() => {}); trim(IMG, IMG_MAX); }
  return res;
}

async function staleWhileRevalidate(req) {
  const c = await caches.open(API);
  const hit = await c.match(req);
  const net = fetch(req).then(async (res) => {
    if (res.ok && res.status === 200) { await c.put(req, res.clone()).catch(() => {}); trim(API, API_MAX); }
    return res;
  });
  if (hit) { net.catch(() => {}); return hit; }
  return net;
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== IMG && k !== API).map((k) => caches.delete(k))))
      // no clients.claim(): taking over a page mid-load made its in-flight fetches (assets/FontManifest.json) fail
      // on a first visit -> white screen. The new worker controls the next load instead.
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  // Carvo image proxy: URLs are immutable (source + size) -> cache-first, size-limited.
  if (url.origin === IMG_ORIGIN && url.pathname === '/i') { event.respondWith(cacheFirst(req)); return; }
  // catalog lists that change slowly: answer from cache at once, refresh in the background.
  if (url.origin === API_ORIGIN && SWR.test(url.pathname)) { event.respondWith(staleWhileRevalidate(req)); return; }
  if (url.origin !== self.location.origin) return;
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
      // one plain retry first: a fetch that fails while the worker is taking control must not break the app start
      .catch(() => fetch(req))
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
