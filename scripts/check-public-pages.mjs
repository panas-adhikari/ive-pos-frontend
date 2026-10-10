// Server-render checks only. No browser or Playwright is launched.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { default: LandingPage } = await server.ssrLoadModule('/src/public/LandingPage.tsx')
  const { default: SignInPage } = await server.ssrLoadModule('/src/public/SignInPage.tsx')
  const landing = renderToStaticMarkup(React.createElement(LandingPage))
  assert.equal((landing.match(/<h1\b/g) || []).length, 1)
  const { appLoginUrl } = await server.ssrLoadModule('/src/public/host.ts')
  assert.ok(landing.includes(`href="${appLoginUrl}"`))
  assert.equal(appLoginUrl, 'http://app.localhost:5173/login')
  assert.doesNotMatch(landing, /href="\/login"/)
  assert.match(landing, /name="workspace"/)
  assert.match(landing, /\/images\/product\/ive-pos-inventory-hero.webp/)
  assert.match(landing, /href="\/features#inventory"/)
  assert.match(landing, /Sample store data/)
  assert.doesNotMatch(landing, /\/images\/retail-counter.png/)
  const { default: FeaturesPage } = await server.ssrLoadModule('/src/public/FeaturesPage.tsx')
  const features = renderToStaticMarkup(React.createElement(FeaturesPage))
  assert.equal((features.match(/<h1\b/g) || []).length, 1)
  assert.ok(features.includes(`href="${appLoginUrl}"`))
  assert.doesNotMatch(features, /href="\/login"/)
  for (const id of ['pos', 'inventory', 'multi-store', 'access', 'reporting']) assert.match(features, new RegExp(`id="${id}"`))
  const props = { busy: false, error: '', emailEnabled: true, submit() {}, recover() {}, signup() {} }
  const tenant = renderToStaticMarkup(React.createElement(SignInPage, { ...props, site: {
    platform_url: 'https://ivepos.me', tenant_base_domain: 'ivepos.me',
    organization: { id: '1', slug: 'mountain-shop', name: 'Mountain Shop', image_url: 'https://example.com/logo.png', login_url: 'https://mountain-shop.ivepos.me/login' },
  } }))
  assert.match(tenant, /Mountain Shop logo/)
  assert.match(tenant, /mountain-shop.ivepos.me/)
  assert.match(tenant, /alt="Ive POS"/)
  assert.match(tenant, /autoComplete="username"/)
  assert.match(tenant, /autoComplete="one-time-code"/)
  assert.doesNotMatch(tenant, /Create account/)
  const platform = renderToStaticMarkup(React.createElement(SignInPage, { ...props, site: {
    platform_url: 'https://ivepos.me', tenant_base_domain: 'ivepos.me', organization: null,
  } }))
  assert.match(platform, /Sign in to Ive POS/)
  assert.match(platform, /Create account/)
  console.log('Public page checks passed: landing, organization branding, platform login, and form semantics.')
} finally {
  await server.close()
}
