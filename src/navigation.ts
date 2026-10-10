import { useSyncExternalStore } from 'react'

const navigationEvent = 'ivepos:navigation'
function subscribe(listener: () => void) {
  window.addEventListener('popstate', listener)
  window.addEventListener(navigationEvent, listener)
  return () => {
    window.removeEventListener('popstate', listener)
    window.removeEventListener(navigationEvent, listener)
  }
}
export function usePathname() {
  return useSyncExternalStore(subscribe, () => window.location.pathname.replace(/\/$/, '') || '/', () => '/')
}
export function navigate(path: string, replace = false) {
  if (path === window.location.pathname + window.location.search && !window.location.hash) return
  window.history[replace ? 'replaceState' : 'pushState'](null, '', path)
  window.dispatchEvent(new Event(navigationEvent))
}
export const organizationPaths = {
  terminal: '/terminal', report: '/reports', operations: '/inventory',
  stores: '/stores', people: '/people', settings: '/settings', setup: '/setup',
} as const
export const platformPaths = { overview: '/overview', organizations: '/organizations', users: '/platform/users' } as const
export function organizationSectionForPath(path: string) {
  return (Object.keys(organizationPaths) as (keyof typeof organizationPaths)[]).find(section => organizationPaths[section] === path) || null
}
export function isPlatformPath(path: string) {
  return Object.values(platformPaths).includes(path as typeof platformPaths[keyof typeof platformPaths])
    || path === '/platform' || /^\/organizations\/[^/]+$/.test(path)
}
export function isWorkspacePath(path: string) {
  return ['/', '/login', '/app', '/platform', '/profile', ...Object.values(organizationPaths), ...Object.values(platformPaths)].includes(path)
    || /^\/organizations\/[^/]+$/.test(path)
}
