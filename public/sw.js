// Minimal service worker to satisfy /sw.js requests
// This does not implement caching; it's a no-op SW.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});

self.addEventListener('fetch', () => {
  // passthrough
});


