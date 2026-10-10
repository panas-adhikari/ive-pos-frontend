const localDevelopment = import.meta.env.MODE === 'development'
const localPort = typeof window === 'undefined' ? '5173' : window.location.port
// Local marketing and authentication use sibling hosts, just like production.
export const appLoginUrl = localDevelopment
  ? `http://app.localhost${localPort ? `:${localPort}` : ''}/login`
  : import.meta.env.VITE_APP_LOGIN_URL || 'https://app.ivepos.me/login'
export const tenantBaseDomain = localDevelopment
  ? 'localhost'
  : (import.meta.env.VITE_TENANT_BASE_DOMAIN || 'ivepos.me').toLowerCase()
const reserved = new Set(['www', 'app', 'api', 'admin', 'platform', 'auth', 'login', 'signup', 'mail', 'smtp', 'support', 'status', 'static', 'assets', 'cdn', 'docs', 'help', 'billing'])
export function isOrganizationHost(host = window.location.hostname) {
  if (!host.endsWith(`.${tenantBaseDomain}`)) return false
  return !reserved.has(host.slice(0, -(tenantBaseDomain.length + 1)))
}
export function workspaceUrl(slug: string, base = tenantBaseDomain) {
  const value = slug.trim().toLowerCase()
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value) || reserved.has(value)) {
    throw new Error('Enter your store address using letters, numbers, and hyphens.')
  }
  const local = base === 'localhost'
  return `${local ? 'http' : 'https'}://${value}.${base}${local && window.location.port ? `:${window.location.port}` : ''}/login`
}
