const VERSION = 'ptcg-searcher-24c0879d2e4bc84e'
const CACHE_PREFIX = 'ptcg-searcher:' + new URL(self.registration.scope).pathname + ':'
const APP_CACHE = CACHE_PREFIX + VERSION + '-app'
const DATA_CACHE = CACHE_PREFIX + VERSION + '-data'
const IMAGE_CACHE = CACHE_PREFIX + 'images-v1'
const APP_FILES = ["/", "/manifest.webmanifest", "/icon.svg", "/assets/index-CNr6O0nU.js", "/assets/index-d0kzLyo5.css"]

function scopedUrl(path) {
  return new URL(path.replace(/^\/+/, ''), self.registration.scope).href
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(APP_FILES.map(scopedUrl)))
      .then(() => caches.open(DATA_CACHE))
      .then(cache => cache.addAll(['/data/cards.json', '/data/image-cache.json'].map(scopedUrl)))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith(CACHE_PREFIX) && ![APP_CACHE, DATA_CACHE, IMAGE_CACHE].includes(key))
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) {
      try { await cache.put(request, response.clone()) } catch {}
    } else {
      const cached = await cache.match(request)
      if (cached) return cached
    }
    return response
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    throw new Error('离线资源尚未缓存')
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    try { await cache.put(request, response.clone()) } catch {}
  }
  return response
}

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  const scopePath = new URL(self.registration.scope).pathname
  if (!url.pathname.startsWith(scopePath)) return
  const path = '/' + url.pathname.slice(scopePath.length)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, APP_CACHE).catch(() => caches.match(scopedUrl('/'))))
    return
  }
  if (path === '/data/cards.json' || path === '/data/image-cache.json') {
    event.respondWith(networkFirst(request, DATA_CACHE))
    return
  }
  if (path.startsWith('/card-images/')) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE))
    return
  }
  if (path.startsWith('/assets/') || path === '/manifest.webmanifest' || path === '/icon.svg') {
    event.respondWith(cacheFirst(request, APP_CACHE))
  }
})
