import { copyFile, writeFile } from 'node:fs/promises'

// GitHub Pages serves this shell for direct nested URLs (with HTTP status 404).
// Navigation currently lives in React state; no route mapping is being invented here.
await copyFile('dist/index.html', 'dist/404.html')
await writeFile('dist/.nojekyll', '')
const domain = process.env.PAGES_CUSTOM_DOMAIN
if (domain) {
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) {
    throw new Error('PAGES_CUSTOM_DOMAIN must be a hostname without a scheme or path')
  }
  await writeFile('dist/CNAME', `${domain}\n`)
}
