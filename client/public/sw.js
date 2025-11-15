// Service Worker for Groove Garden Studios
// Caches static assets for faster subsequent loads

const CACHE_NAME = 'groove-garden-v1';
const urlsToCache = [
  '/',
  '/src/main.tsx',
  '/src/index.css'
];

// Install event - cache critical resources
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache).catch(function() {
          // Silently fail if caching doesn't work
        });
      })
  );
  self.skipWaiting();
});

// Fetch event - serve from cache when available
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});
