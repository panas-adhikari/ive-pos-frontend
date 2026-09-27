// Test a built artifact with Pages-style 404 fallback and a mocked API.
// First build with VITE_API_URL=https://api.example.com.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import http from 'node:http'
import { resolve, extname } from 'node:path'
import { chromium } from '@playwright/test'

const root = resolve('dist')
const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  const file = resolve(root, `.${path === '/' ? '/index.html' : path}`)
  if (!file.startsWith(`${root}/`)) { res.writeHead(400); res.end(); return }
  try {
    const data = await readFile(file)
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.html': 'text/html' }
    res.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' })
    res.end(data)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html' })
    res.end(await readFile(resolve(root, '404.html')))
  }
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
let browser
try {
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  const requests = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://api.example.com/**', async route => {
    requests.push(route.request().url())
    const path = new URL(route.request().url()).pathname
    await route.fulfill({
      status: path.endsWith('/me') || path.endsWith('/refresh') ? 401 : 200,
      contentType: 'application/json',
      body: JSON.stringify(path.endsWith('/ready') ? { status: 'ready' } : {}),
    })
  })
  for (const path of ['/', '/stores/example', '/stores/example']) {
    const response = path === '/stores/example' && page.url().endsWith(path)
      ? await page.reload() : await page.goto(`http://127.0.0.1:${server.address().port}${path}`)
    assert.equal(response.status(), path === '/' ? 200 : 404)
    await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
    assert.ok((await page.locator('#root').innerText()).length > 20)
  }
  assert.ok(requests.some(url => url.endsWith('/api/v1/auth/me')))
  assert.deepEqual(errors, [])
  console.log('Hosted build: root, nested navigation, refresh, API origin, and runtime checks passed')
} finally {
  await browser?.close()
  await new Promise(done => server.close(done))
}
