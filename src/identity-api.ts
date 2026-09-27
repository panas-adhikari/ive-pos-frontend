import { apiUrl } from './api-url'

export async function authRequest(path: string, body?: object) {
  return fetch(apiUrl(`/api/v1/auth/${path}`), {
    method: body === undefined ? 'GET' : 'POST', credentials: 'include', cache: 'no-store',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-POS-CSRF': '1' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15_000),
  })
}

export type EmailLink = { purpose: string; token: string }
export function takeEmailLink(): EmailLink | null {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const purpose = params.get('identity'), token = params.get('token')
  if (!purpose || !token || !['signup', 'reset', 'verify', 'invite'].includes(purpose)) return null
  // The fragment never reaches the server; remove it from browser history immediately.
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return { purpose, token }
}
