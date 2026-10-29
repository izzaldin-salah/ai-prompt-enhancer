import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const buildDirectory = path.resolve(process.env.PWA_BUILD_DIR || 'dist')
const base = process.env.PWA_BASE || '/'
const read = (file) => readFileSync(path.join(buildDirectory, file))

test('built manifest launches a standalone app and references correctly sized PNG icons', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'))
  assert.equal(manifest.name, 'Prompta — AI Prompt Assistant')
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.start_url, './')
  assert.equal(manifest.scope, './')
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192' && icon.purpose === 'any'))
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'any'))
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'))
  for (const icon of manifest.icons) {
    const png = read(icon.src)
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes)
  }
  const appleIcon = read('icons/apple-touch-icon.png')
  assert.equal(appleIcon.readUInt32BE(16), 180)
  assert.equal(appleIcon.readUInt32BE(20), 180)
})

test('built HTML links the manifest, Apple icon, and scripts under the deployment base', () => {
  const html = read('index.html').toString()
  assert.ok(html.includes(`rel="manifest" href="${base}manifest.webmanifest"`))
  assert.ok(html.includes(`href="${base}icons/apple-touch-icon.png"`))
  assert.ok(html.includes('name="apple-mobile-web-app-capable" content="yes"'))
  assert.ok(html.includes('viewport-fit=cover'))
  for (const match of html.matchAll(/(?:src|href)="([^"\s]+)"/g)) {
    assert.ok(match[1].startsWith(base), `Unexpected asset base: ${match[1]}`)
    assert.ok(statSync(path.join(buildDirectory, match[1].slice(base.length))).isFile())
  }
})

test('emitted worker precaches actual build files and contains no unresolved placeholders', () => {
  const worker = read('sw.js').toString()
  assert.ok(!worker.includes('__PRECACHE_FILES__'))
  assert.ok(!worker.includes('__BUILD_VERSION__'))
  const files = JSON.parse(worker.match(/const PRECACHE_FILES = (\[[^\n]+\])/)[1])
  assert.ok(files.includes('index.html'))
  assert.ok(files.includes('manifest.webmanifest'))
  assert.ok(files.some((file) => /^assets\/.+\.js$/.test(file)))
  assert.ok(files.some((file) => /^assets\/.+\.css$/.test(file)))
  assert.ok(files.every((file) => !file.endsWith('.map')))
  for (const file of files) assert.ok(statSync(path.join(buildDirectory, file)).isFile(), file)
})
