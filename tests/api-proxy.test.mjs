import test from 'node:test'
import assert from 'node:assert/strict'
import { proxy } from '../api/proxy.mjs'

const env = { API_PROXY_ORIGIN: 'https://api.ivepos.me' }
function request(path = 'v1/public/site', options = {}, host = 'atharva.ivepos.me') {
  return new Request(`https://${host}/api/proxy?__ivepos_path=${encodeURIComponent(path)}`, options)
}
test('same-origin tenant GET supplies tenant context and retains query parameters', async () => {
  const req = new Request('https://atharva.ivepos.me/api/proxy?__ivepos_path=v1%2Fpublic%2Fsite&query=milk')
  const response = await proxy(req, { env, fetchUpstream: async (url, options) => {
    assert.equal(String(url), 'https://api.ivepos.me/api/v1/public/site?query=milk')
    assert.equal(options.headers.get('origin'), 'https://atharva.ivepos.me')
    assert.equal(options.redirect, 'manual')
    return Response.json({ organization: { slug: 'atharva' } })
  } })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).organization.slug, 'atharva')
  assert.equal(response.headers.get('cache-control'), 'no-store')
})
test('login forwards body and keeps both host-only cookies', async () => {
  const headers = { Origin: 'https://atharva.ivepos.me', 'X-POS-CSRF': '1', 'Content-Type': 'application/json', Cookie: '__Host-existing=session' }
  const payload = JSON.stringify({ email: 'owner@example.com', password: 'test-only' })
  const response = await proxy(request('v1/auth/login', { method: 'POST', headers, body: payload }), { env, fetchUpstream: async (url, options) => {
    assert.equal(options.headers.get('cookie'), '__Host-existing=session')
    assert.equal(await new Response(options.body).text(), payload)
    const output = new Headers()
    output.append('set-cookie', '__Host-access=access; Path=/; Secure; HttpOnly; SameSite=Strict')
    output.append('set-cookie', '__Host-refresh=refresh; Path=/; Secure; HttpOnly; SameSite=Strict')
    return new Response('{}', { headers: output })
  } })
  assert.equal(response.headers.getSetCookie().length, 2)
  assert.ok(response.headers.getSetCookie().every(cookie => !cookie.includes('Domain=')))
})
test('rejects missing, sibling and cross-site origins before forwarding a write', async () => {
  for (const headers of [{}, { Origin: 'https://other.ivepos.me', 'X-POS-CSRF': '1' }, { Origin: 'https://atharva.ivepos.me', 'X-POS-CSRF': '1', 'Sec-Fetch-Site': 'cross-site' }]) {
    const response = await proxy(request('v1/auth/login', { method: 'POST', headers }), { env, fetchUpstream: () => assert.fail('Rejected write reached backend') })
    assert.equal(response.status, 403)
  }
})
test('rejects sibling origins on reads', async () => {
  const response = await proxy(request(undefined, { headers: { Origin: 'https://other.ivepos.me' } }), { env, fetchUpstream: () => assert.fail('Sibling request reached backend') })
  assert.equal(response.status, 403)
})
test('rejects unrecognized and reserved hosts; permits the app host', async () => {
  for (const host of ['evil.example', 'www.ivepos.me', 'api.ivepos.me', 'nested.atharva.ivepos.me']) {
    assert.equal((await proxy(request(undefined, {}, host), { env, fetchUpstream: () => assert.fail('Invalid host reached backend') })).status, 403)
  }
  assert.equal((await proxy(request(undefined, {}, 'app.ivepos.me'), { env, fetchUpstream: async () => Response.json({}) })).status, 200)
})
test('retains backend unknown-tenant and authentication errors', async () => {
  for (const status of [401, 403, 404, 422]) {
    const response = await proxy(request(), { env, fetchUpstream: async () => Response.json({ detail: 'Backend error' }, { status }) })
    assert.equal(response.status, status)
    assert.equal((await response.json()).detail, 'Backend error')
  }
})
test('invalid paths and proxy configuration cannot redirect requests elsewhere', async () => {
  for (const path of ['../admin', 'v1/../admin', 'https://evil.example', 'v1/public/site?secret=x']) {
    assert.equal((await proxy(request(path), { env, fetchUpstream: () => assert.fail('Invalid path reached backend') })).status, 400)
  }
  const duplicate = new Request('https://atharva.ivepos.me/api/proxy?__ivepos_path=v1/a&__ivepos_path=v1/b')
  assert.equal((await proxy(duplicate, { env })).status, 400)
  assert.equal((await proxy(request(), { env: { API_PROXY_ORIGIN: 'http://api.ivepos.me' } })).status, 503)
})
test('backend redirects stay on the workspace host', async () => {
  const response = await proxy(request(), { env, fetchUpstream: async () => new Response(null, { status: 307, headers: { Location: 'https://api.ivepos.me/api/v1/public/site/' } }) })
  assert.equal(response.headers.get('location'), 'https://atharva.ivepos.me/api/v1/public/site/')
})
test('connection failures return a sanitized error', async () => {
  const response = await proxy(request(), { env, fetchUpstream: async () => { throw new Error('private diagnostic') } })
  assert.equal(response.status, 502)
  assert.ok(!(await response.text()).includes('private diagnostic'))
})
