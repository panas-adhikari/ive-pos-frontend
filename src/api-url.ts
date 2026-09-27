// Public build-time configuration. No secrets belong in VITE_* variables.
const origin = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export function apiUrl(path: string): string {
  if (!path.startsWith('/api/')) throw new Error('Expected an application API path')
  return `${origin}${path}`
}
