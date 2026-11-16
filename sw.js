// Plattenkiste service worker: keeps the app itself usable offline.
//
// It deliberately keeps ONLY the app's own files and the fonts. Pictures from other sites (record covers,
// Pokémon card images) come back as "opaque" responses, and Chrome counts every opaque response in this
// storage as roughly 7-9 MB, however small the picture is. Caching card images that way filled the app's
// storage within a few set views, saving then failed and Chrome wiped the app's whole storage (records,
// cards, settings) to make room. Pictures are left to the browser's normal image cache, which doesn't count.
const CACHE = "plattenkiste-v25";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

// Drops every older cache, including the ones full of opaque pictures.
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // App page: network first so updates arrive, cache as fallback.
  if (req.mode === "navigate" || (url.origin === location.origin && /index\.html$|\/$/.test(url.pathname))) {
    e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put("index.html", copy)); } return res; })
      .catch(() => caches.match("index.html")));
    return;
  }

  // Own files and fonts: cache first, and never store an opaque response.
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type !== "opaque") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
  // Everything else (APIs, covers, card images, previews) goes straight to the network and the browser's own cache.
});
