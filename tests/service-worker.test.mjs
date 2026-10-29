import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const scope = 'https://prompta.test/mobile/'
const files = ['index.html', 'assets/app.js', 'assets/app.css', 'manifest.webmanifest']

function worker() {
  const handlers = {}
  const stores = new Map()
  let online = true
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map())
      const entries = stores.get(name)
      return {
        async addAll(urls) {
          for (const url of urls) entries.set(url, new Response(`cached:${url}`))
        },
        async match(request) { return entries.get(request.url || request)?.clone() },
      }
    },
    async keys() { return [...stores.keys()] },
    async delete(name) { return stores.delete(name) },
  }
  const source = readFileSync(new URL('../src/service-worker.js', import.meta.url), 'utf8')
    .replace('__PRECACHE_FILES__', JSON.stringify(files))
    .replace('__BUILD_VERSION__', JSON.stringify('test-version'))
  vm.runInNewContext(source, {
    URL, Response, caches,
    fetch: async () => {
      if (!online) throw new TypeError('Offline')
      return new Response('network')
    },
    self: {
      registration: { scope },
      clients: { claim: async () => {} },
      addEventListener: (name, fn) => { handlers[name] = fn },
    },
  })
  return {
    stores, caches,
    offline() { online = false },
    async lifecycle(name) {
      let pending
      handlers[name]({ waitUntil(promise) { pending = promise } })
      await pending
    },
    fetch(path, options = {}) {
      let response
      handlers.fetch({
        request: { url: new URL(path, scope).href, method: 'GET', mode: 'cors', ...options },
        respondWith(promise) { response = Promise.resolve(promise) },
      })
      return response
    },
  }
}

test('precaches the shell and reopens it offline under a nested deployment path', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  sw.offline()
  const response = await sw.fetch('./?launch=home', { mode: 'navigate' })
  assert.equal(await response.text(), `cached:${scope}index.html`)
  assert.equal(await (await sw.fetch('assets/app.js')).text(), `cached:${scope}assets/app.js`)
})

test('uses the same cached shell online so HTML and hashed assets stay in sync', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  assert.equal(await (await sw.fetch('./', { mode: 'navigate' })).text(), `cached:${scope}index.html`)
})

test('never intercepts API requests, POSTs, external resources, or unrelated navigation', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  assert.equal(sw.fetch('api/session'), undefined)
  assert.equal(sw.fetch('assets/app.js', { method: 'POST' }), undefined)
  assert.equal(sw.fetch('https://api.example.com/chat/completions'), undefined)
  assert.equal(sw.fetch('https://fonts.googleapis.com/css2'), undefined)
  assert.equal(sw.fetch('/other-app/', { mode: 'navigate' }), undefined)
})

test('activation removes only old caches belonging to this app and scope', async () => {
  const sw = worker()
  await sw.lifecycle('install')
  const [current] = await sw.caches.keys()
  const prefix = current.slice(0, -'test-version'.length)
  await sw.caches.open(`${prefix}old-version`)
  await sw.caches.open('other-app-cache')
  await sw.caches.open('prompta-shell:other-scope:old-version')
  await sw.lifecycle('activate')
  assert.equal(sw.stores.has(`${prefix}old-version`), false)
  assert.equal(sw.stores.has(current), true)
  assert.equal(sw.stores.has('other-app-cache'), true)
  assert.equal(sw.stores.has('prompta-shell:other-scope:old-version'), true)
})
