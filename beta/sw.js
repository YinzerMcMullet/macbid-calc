// MacBid Calculator service worker — offline support
// Bump the version on every deploy so users pick up the new build.
var CACHE = 'macbid-calc-beta-v27';
var ASSETS = [
  './',
  './index.html',
  './logo.png',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(key) {
        if (key !== CACHE) return caches.delete(key);
      }));
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Page loads: network-first so beta testers see every new deploy on a single
  // normal refresh. Falls back to cache when offline.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function(resp) {
        if (resp && resp.status === 200) {
          var copy = resp.clone();
          caches.open(CACHE).then(function(cache) { cache.put(e.request, copy); });
        }
        return resp;
      }).catch(function() {
        return caches.open(CACHE).then(function(cache) {
          return cache.match(e.request, { ignoreSearch: true }).then(function(hit) {
            return hit || cache.match('./index.html');
          });
        });
      })
    );
    return;
  }

  // Assets: serve from cache instantly (works offline / on warehouse signal),
  // refresh the cache in the background.
  e.respondWith(
    caches.open(CACHE).then(function(cache) {
      return cache.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }).then(function(cached) {
        var fetched = fetch(e.request).then(function(resp) {
          if (resp && resp.status === 200) {
            cache.put(e.request, resp.clone());
          }
          return resp;
        }).catch(function() {
          return cached;
        });
        return cached || fetched;
      });
    })
  );
});
