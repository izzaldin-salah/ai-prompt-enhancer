// Replaced by the Vite PWA plugin with this build's exact asset list and version.
const PRECACHE_FILES = __PRECACHE_FILES__
const BUILD_VERSION = __BUILD_VERSION__
const CACHE_PREFIX = `prompta-shell:${self.registration.scope}:`
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`
const SHELL_URL = new URL('index.html', self.registration.scope).href
const ASSET_URLS = new Set(PRECACHE_FILES.map((file) => new URL(file, self.registration.scope).href))

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([...ASSET_URLS])))
  // Updates wait until existing tabs close, keeping each shell and its assets together.
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  const scope = new URL(self.registration.scope)
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return

  // Only the app entry points and build assets are cached; API responses stay on the network.
  const isShell = request.mode === 'navigate'
    && (url.pathname === scope.pathname || url.href.split('?')[0] === SHELL_URL)
  const cacheKey = isShell ? SHELL_URL : request.url
  if (!isShell && !ASSET_URLS.has(cacheKey)) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    return await cache.match(cacheKey) || fetch(request)
  })())
})
