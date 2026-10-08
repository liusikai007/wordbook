/* 词簿的 Service Worker：只负责「加到主屏幕后离线也能打开」。
   策略：
   - 导航请求：网络优先，断网时回退到缓存里的 index.html
   - 同源静态资源：先给缓存，同时后台更新（stale-while-revalidate）
   - 第三方词典接口：完全不拦截，交给页面里的 localStorage 缓存处理 */
const CACHE = 'wordbook-v1'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

function putInCache(request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return
  caches
    .open(CACHE)
    .then((cache) => cache.put(request, response))
    .catch(() => undefined)
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          putInCache(request, response.clone())
          return response
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('./index.html'))
        )
    )
    return
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          putInCache(request, response.clone())
          return response
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
