// AirUP service worker.
//  • The app page: network first (a deploy shows up on the next open), saved copy
//    after 8 s on a weak signal or with no signal at all.
//  • Book pages, covers, icons and the React/Supabase/font libraries: cache first,
//    so they download once and the app opens fast and offline after that.
// Bump VERSION whenever you want every installed copy to drop its old cache.
const VERSION = 'airup-v4';
const SHELL = ['./', './index.html', './support.js', './manifest.webmanifest', './logo.png', './icon-192.png', './icon-512.png'];
const LIBS = ['unpkg.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const cacheFirst = req => caches.match(req).then(hit => hit || fetch(req).then(res => {
  if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
  return res;
}));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) {
    // Supabase, Google sign-in, Razorpay and Meta stay live; only static libraries are kept
    if (LIBS.indexOf(url.hostname) > -1) e.respondWith(cacheFirst(req));
    return;
  }

  if (/\.(png|jpe?g|webp|svg|ico|woff2?)$/i.test(url.pathname)) { e.respondWith(cacheFirst(req)); return; }

  const nav = req.mode === 'navigate';
  const key = nav ? './index.html' : req;
  const live = fetch(req).then(res => {
    // never cache a sign-in return (?code=…) as the app page
    if (res && res.ok && !url.search) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(key, copy)); }
    return res;
  });
  const timed = nav ? Promise.race([live, new Promise((_, no) => setTimeout(no, 8000))]) : live;
  e.respondWith(timed.catch(() => caches.match(key, { ignoreSearch: true }).then(hit => hit || live)));
});

// tapping the daily reminder opens (or focuses) the app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
