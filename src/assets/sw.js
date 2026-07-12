// Service Worker — offline-first caching for Airstream Explorer PWA.
// Versioned by build; build.mjs replaces the placeholder below.
var CACHE_VERSION = '__BUILD_VERSION__';
var CACHE_NAME = 'ae-v' + CACHE_VERSION;

// Core shell assets precached on install. build.mjs injects the real
// fingerprinted filenames here.
var PRECACHE = __PRECACHE_MANIFEST__;

// Install: precache the shell
self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k.startsWith('ae-v') && k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// Fetch: fingerprinted assets = cache-first; HTML = network-first + cache fallback
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // Only handle same-origin GET requests
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Fingerprinted assets (contain a hash in the filename): cache-first, immutable
  if (/\/assets\/.*\.[0-9a-f]{8}\./.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(function (cached) {
        if (cached) return cached;
        return fetch(e.request).then(function (resp) {
          if (resp.ok) {
            var clone = resp.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(e.request, clone); });
          }
          return resp;
        });
      })
    );
    return;
  }

  // HTML pages: network-first, cache fallback, then offline page
  if (e.request.headers.get('accept') && e.request.headers.get('accept').indexOf('text/html') !== -1) {
    e.respondWith(
      fetch(e.request).then(function (resp) {
        if (resp.ok) {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(e.request, clone); });
        }
        return resp;
      }).catch(function () {
        return caches.match(e.request).then(function (cached) {
          return cached || caches.match('/offline.html');
        });
      })
    );
    return;
  }

  // Other same-origin assets (fonts, map data, vendor JS): stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fetchPromise = fetch(e.request).then(function (resp) {
        if (resp.ok) {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(e.request, clone); });
        }
        return resp;
      }).catch(function () { return cached; });
      return cached || fetchPromise;
    })
  );
});
