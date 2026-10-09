export const publicSiteUrl = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://ivepos.me').replace(/\/$/, '')
export const publicPages = {
  '/': {
    title: 'Ive POS — POS & Inventory Management Software for Nepal',
    description: 'Run your retail store with Ive POS. Cash billing, barcode search, inventory, multiple stores, staff permissions, and daily sales reports in one workspace.',
  },
  '/features': {
    title: 'POS, Inventory & Retail Management Features — Ive POS',
    description: 'Explore Ive POS cash billing, stock and price tracking, multi-store registers, staff access, MFA security, and business-day reports for retail stores in Nepal.',
  },
}
export type PublicPath = keyof typeof publicPages

export function structuredData(path: PublicPath) {
  const graph: Record<string, unknown>[] = [
    { '@type': 'WebSite', '@id': `${publicSiteUrl}/#website`, url: `${publicSiteUrl}/`, name: 'Ive POS', inLanguage: 'en' },
    { '@type': 'SoftwareApplication', '@id': `${publicSiteUrl}/#software`, name: 'Ive POS', url: `${publicSiteUrl}/`, applicationCategory: 'BusinessApplication', operatingSystem: 'Web browser', description: publicPages['/'].description, featureList: ['Cash billing and receipts', 'Barcode product search', 'Inventory and price tracking', 'Multiple stores and registers', 'Roles and staff permissions', 'Business-day sales reports', 'Authenticator MFA'] },
  ]
  if (path === '/features') graph.push({ '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Ive POS', item: `${publicSiteUrl}/` },
    { '@type': 'ListItem', position: 2, name: 'Features', item: `${publicSiteUrl}/features` },
  ] })
  return { '@context': 'https://schema.org', '@graph': graph }
}

export function applyPageMetadata(path: string, tenant: boolean) {
  const key = path.replace(/\/$/, '') || '/'
  const publicPath = !tenant && Object.hasOwn(publicPages, key) ? key as PublicPath : null
  const page = publicPath ? publicPages[publicPath] : { title: key === '/login' || tenant ? 'Sign in — Ive POS' : key === '/app' ? 'Workspace — Ive POS' : 'Page not found — Ive POS', description: 'Secure access to your Ive POS workspace.' }
  document.title = page.title
  const setMeta = (name: string, content: string, property = false) => {
    const selector = property ? 'property' : 'name'
    let tag = document.head.querySelector<HTMLMetaElement>(`meta[${selector}="${name}"]`)
    if (!tag) { tag = document.createElement('meta'); tag.setAttribute(selector, name); document.head.append(tag) }
    tag.content = content
  }
  setMeta('description', page.description)
  setMeta('robots', publicPath ? 'index, follow, max-image-preview:large' : 'noindex, nofollow')
  document.head.querySelectorAll('link[rel="canonical"], script[data-public-schema]').forEach(tag => tag.remove())
  if (publicPath) {
    const canonical = document.createElement('link'); canonical.rel = 'canonical'; canonical.href = `${publicSiteUrl}${publicPath}`; document.head.append(canonical)
    setMeta('og:title', page.title, true); setMeta('og:description', page.description, true); setMeta('og:url', canonical.href, true)
    setMeta('twitter:title', page.title); setMeta('twitter:description', page.description)
    const schema = document.createElement('script'); schema.type = 'application/ld+json'; schema.dataset.publicSchema = ''; schema.textContent = JSON.stringify(structuredData(publicPath)); document.head.append(schema)
  } else document.head.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach(tag => tag.remove())
}
