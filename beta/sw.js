// Self-destructing service worker: the app moved to a new address.
// Replaces the old caching worker on installed copies, wipes the old cache,
// unregisters itself, and reloads open pages so they hit the redirect.
self.addEventListener('install', function() { self.skipWaiting(); });
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(ks) { return Promise.all(ks.map(function(k) { return caches.delete(k); })); })
      .then(function() { return self.registration.unregister(); })
      .then(function() { return self.clients.matchAll({ type: 'window' }); })
      .then(function(cs) { cs.forEach(function(c) { if (c.navigate) c.navigate(c.url); }); })
      .catch(function() {})
  );
});
