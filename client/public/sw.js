// Service Worker for Groove Garden Studios
// Uses "network first" strategy for fresh content with cache fallback

const CACHE_NAME = 'groove-garden-v2';

// Install event - skip waiting to activate immediately
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Fetch event - NETWORK FIRST strategy (always get fresh content)
self.addEventListener('fetch', function(event) {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip API requests - always fetch fresh
  if (event.request.url.includes('/api/')) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(function(networkResponse) {
        // Got network response - cache it and return
        if (networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(function() {
        // Network failed - try cache as fallback
        return caches.match(event.request);
      })
  );
});

// Activate event - clean up ALL old caches immediately
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          // Delete all old cache versions
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});
