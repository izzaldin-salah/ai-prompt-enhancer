import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

// Build-time precaching without another runtime dependency or a hand-maintained bundle list.
export function promptaPwa(): Plugin {
  let root: string
  let publicDir: string
  return {
    name: 'prompta-pwa',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      root = config.root
      publicDir = config.publicDir
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const manifest = readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8')
        const icons = JSON.parse(manifest).icons as { src: string }[]
        const publicFiles = [...new Set([
          'manifest.webmanifest', 'favicon.svg', 'icons/apple-touch-icon.png',
          ...icons.map((icon) => icon.src.replace(/^\.\//, '')),
        ])]
        const assets = Object.keys(bundle).filter((name) => /\.(html|js|css|woff2?)$/.test(name)).sort()
        const template = readFileSync(path.join(root, 'src/service-worker.js'), 'utf8')
        const version = createHash('sha256').update(template)
        for (const name of assets) {
          const asset = bundle[name]
          version.update(name).update(asset.type === 'chunk' ? asset.code : asset.source)
        }
        for (const name of publicFiles) {
          version.update(name).update(readFileSync(path.join(publicDir, name)))
        }
        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: template
            .replace('__PRECACHE_FILES__', JSON.stringify([...assets, ...publicFiles]))
            .replace('__BUILD_VERSION__', JSON.stringify(version.digest('hex').slice(0, 16))),
        })
      },
    },
  }
}
