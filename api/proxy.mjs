const reserved = new Set(['www', 'app', 'api', 'admin', 'platform', 'auth', 'login', 'signup', 'mail', 'smtp', 'support', 'status', 'static', 'assets', 'cdn', 'docs', 'help', 'billing'])
const readMethods = new Set(['GET', 'HEAD', 'OPTIONS'])
function error(status, detail) {
  return Response.json({ detail }, { status, headers: { 'Cache-Control': 'no-store' } })
}

// This runs on Vercel, not in the browser. Never expose database or auth secrets here.
export async function proxy(request, { env = process.env, fetchUpstream = fetch } = {}) {
  const incoming = new URL(request.url)
  const base = (env.VITE_TENANT_BASE_DOMAIN || 'ivepos.me').toLowerCase()
  const platform = new URL(env.VITE_APP_LOGIN_URL || 'https://app.ivepos.me/login')
  const slug = incoming.hostname.endsWith(`.${base}`) ? incoming.hostname.slice(0, -(base.length + 1)) : ''
  const tenant = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) && !reserved.has(slug)
  if (incoming.protocol !== 'https:' || incoming.port || !(tenant || incoming.origin === platform.origin)) return error(403, 'Workspace host rejected')

  // Reject sibling/cross-site origins before supplying context for same-origin GETs.
  const origin = request.headers.get('origin')
  if (origin && origin !== incoming.origin) return error(403, 'Request origin rejected')
  const writes = !readMethods.has(request.method)
  if (writes && (!origin || request.headers.get('x-pos-csrf') !== '1' || request.headers.get('sec-fetch-site') === 'cross-site')) return error(403, 'Request origin rejected')

  const paths = incoming.searchParams.getAll('__ivepos_path')
  if (paths.length !== 1 || !paths[0].startsWith('v1/') || /[\\?#]/.test(paths[0]) || paths[0].split('/').some(part => ['.', '..'].includes(part))) return error(400, 'Invalid API path')
  let upstream
  try {
    upstream = new URL(env.API_PROXY_ORIGIN || 'https://api.ivepos.me')
    if (upstream.protocol !== 'https:' || upstream.username || upstream.password || upstream.pathname !== '/' || upstream.search || upstream.hash || upstream.origin === incoming.origin) return error(503, 'API proxy is not configured')
  } catch { return error(503, 'API proxy is not configured') }
  upstream.pathname = `/api/${paths[0]}`
  incoming.searchParams.delete('__ivepos_path')
  upstream.search = incoming.searchParams.toString()
  const headers = new Headers()
  for (const name of ['accept', 'content-type', 'cookie', 'x-pos-csrf', 'sec-fetch-site']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set('origin', incoming.origin)
  try {
    const response = await fetchUpstream(upstream, {
      method: request.method, headers,
      body: writes ? request.body : undefined,
      duplex: 'half', redirect: 'manual', signal: AbortSignal.timeout(15000),
    })
    // Preserve each Set-Cookie separately. Secure __Host- cookies remain on this host.
    const outputHeaders = new Headers(response.headers)
    outputHeaders.delete('set-cookie')
    for (const cookie of response.headers.getSetCookie()) outputHeaders.append('set-cookie', cookie)
    for (const name of ['content-encoding', 'content-length', 'transfer-encoding', 'connection']) outputHeaders.delete(name)
    const location = outputHeaders.get('location')
    if (location) {
      const redirect = new URL(location, upstream)
      if (redirect.origin === upstream.origin) outputHeaders.set('location', `${incoming.origin}${redirect.pathname}${redirect.search}${redirect.hash}`)
    }
    outputHeaders.set('Cache-Control', 'no-store')
    return new Response(response.body, { status: response.status, headers: outputHeaders })
  } catch { return error(502, 'Backend unavailable. Please retry.') }
}

export default { fetch: request => proxy(request) }
