import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import { appLoginUrl, isOrganizationHost } from './public/host'
import { applyPageMetadata } from './public/seo'

async function start() {
  const root = document.getElementById('root')!
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  const tenant = isOrganizationHost()
  const emailLink = new URLSearchParams(window.location.hash.slice(1)).has('identity')
  const appHost = window.location.hostname === new URL(appLoginUrl).hostname
  const publicPath = !tenant && !emailLink && (path === '/features' || path === '/' && !appHost)
  applyPageMetadata(emailLink ? '/login' : path, tenant)
  const { default: Entry } = publicPath
    ? path === '/features' ? await import('./public/FeaturesPage') : await import('./public/LandingPage')
    : await import('./ApplicationEntry')
  const entry = <StrictMode><Entry /></StrictMode>
  if (publicPath && root.dataset.prerendered === path) hydrateRoot(root, entry)
  else createRoot(root).render(entry)
}
void start()
