import { mkdir, readFile, writeFile } from 'node:fs/promises'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { createServer } from 'vite'

// Render the same React components used by the client. Public copy/links work without JS.
// Auth and error routes receive an empty, noindex application shell, not marketing content.
const template = await readFile('dist/index.html', 'utf8')
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { publicPages, publicSiteUrl, structuredData } = await server.ssrLoadModule('/src/public/seo.ts')
  const origin = new URL(publicSiteUrl)
  if (origin.protocol !== 'https:' || origin.origin !== publicSiteUrl || origin.username || origin.password) throw new Error('VITE_PUBLIC_SITE_URL must be an exact HTTPS origin')
  const metadata = path => {
    const page = publicPages[path]
    const image = `${publicSiteUrl}/images/product/ive-pos-social-preview.png`
    return `<link rel="canonical" href="${publicSiteUrl}${path}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta property="og:type" content="website" /><meta property="og:site_name" content="Ive POS" />
    <meta property="og:title" content="${escape(page.title)}" /><meta property="og:description" content="${escape(page.description)}" />
    <meta property="og:url" content="${publicSiteUrl}${path}" /><meta property="og:locale" content="en_NP" />
    <meta property="og:image" content="${image}" /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta property="og:image:alt" content="Ive POS inventory and stock management" />
    <meta name="twitter:card" content="summary_large_image" /><meta name="twitter:title" content="${escape(page.title)}" /><meta name="twitter:description" content="${escape(page.description)}" /><meta name="twitter:image" content="${image}" /><meta name="twitter:image:alt" content="Ive POS inventory and stock management" />
    <script type="application/ld+json" data-public-schema>${JSON.stringify(structuredData(path)).replace(/</g, '\\u003c')}</script>`
  }
  const dependencies = (entry, visited = new Set()) => {
    if (!manifest[entry] || visited.has(entry)) return visited
    visited.add(entry)
    for (const dependency of manifest[entry].imports || []) dependencies(dependency, visited)
    return visited
  }
  for (const [path, entry] of [['/', 'LandingPage'], ['/features', 'FeaturesPage']]) {
    const { default: Page } = await server.ssrLoadModule(`/src/public/${entry}.tsx`)
    const body = renderToString(React.createElement(Page))
    const moduleKey = Object.keys(manifest).find(key => key === `src/public/${entry}.tsx` || manifest[key].name === entry)
    if (!moduleKey) throw new Error(`Public bundle missing: ${entry}`)
    const modules = [...dependencies(moduleKey)].map(key => manifest[key])
    const styles = [...new Set(modules.flatMap(module => module.css || []))].map(file => `<link rel="stylesheet" href="/${file}" />`).join('\n')
    const preload = modules.map(module => `<link rel="modulepreload" href="/${module.file}" />`).join('\n')
    const html = template.replace(/<title>.*?<\/title>/s, `<title>${escape(publicPages[path].title)}</title>`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(publicPages[path].description)}" />`)
      .replace('<!-- public-metadata -->', `${metadata(path)}\n${styles}\n${preload}`)
      .replace('<div id="root"></div>', `<div id="root" data-prerendered="${path}">${body}</div>`)
    const destination = path === '/' ? 'dist' : `dist${path}`
    await mkdir(destination, { recursive: true })
    await writeFile(`${destination}/index.html`, html)
  }
  const shell = (title, description) => template.replace(/<title>.*?<\/title>/s, `<title>${title} — Ive POS</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}" />`)
    .replace('<!-- public-metadata -->', '<meta name="robots" content="noindex, nofollow" />')
  for (const [path, title] of [['login', 'Sign in'], ['app', 'Workspace']]) {
    await mkdir(`dist/${path}`, { recursive: true })
    await writeFile(`dist/${path}/index.html`, shell(title, 'Secure access to your Ive POS workspace.'))
  }
  await writeFile('dist/404.html', shell('Page not found', 'The requested Ive POS page could not be found.'))
  await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\n# Authentication pages carry noindex; allow crawling to read that directive.\nSitemap: ${publicSiteUrl}/sitemap.xml\n`)
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(publicPages).map(path => `<url><loc>${publicSiteUrl}${path}</loc></url>`).join('')}</urlset>\n`)
  console.log('Rendered public homepage and features; generated noindex auth/error shells, metadata, robots, and sitemap.')
} finally { await server.close() }
await writeFile('dist/.nojekyll', '')
const domain = process.env.PAGES_CUSTOM_DOMAIN
if (domain) {
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) {
    throw new Error('PAGES_CUSTOM_DOMAIN must be a hostname without a scheme or path')
  }
  await writeFile('dist/CNAME', `${domain}\n`)
}
