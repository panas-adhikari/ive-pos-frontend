import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { AuthBoundary } from '../auth'
import { ProductBrand } from './Brand'
import LandingPage from './LandingPage'
import { isOrganizationHost, loadSite } from './site'
import './public.css'

export default function PublicEntry({ children }: { children: ReactNode }) {
  const tenantHost = isOrganizationHost()
  const path = window.location.pathname.replace(/\/$/, '') || '/'
  const emailLink = new URLSearchParams(window.location.hash.slice(1)).has('identity')
  if (!tenantHost && path === '/' && !emailLink) return <LandingPage />
  if (!['/', '/login', '/app'].includes(path)) return <div className="public-site"><main className="public-container public-status"><ProductBrand /><h1>Page not found</h1><a className="public-button" href="/">Back to Ive POS</a></main></div>
  return <BrandedAuth>{children}</BrandedAuth>
}
function BrandedAuth({ children }: { children: ReactNode }) {
  const site = useQuery({ queryKey: ['public-site', window.location.hostname], queryFn: loadSite, retry: false, staleTime: 60000 })
  if (site.isPending || site.isError) return <div className="public-site"><header className="public-header public-container"><ProductBrand /></header><main className="public-container public-status">{site.isPending ? <p role="status">Loading sign-in…</p> : <><h1>Sign-in unavailable</h1><p role="alert">{site.error.message}</p><div className="public-status-actions"><button className="public-button" onClick={() => void site.refetch()}>Try again</button><a href="/login" className="public-text-link">Check address</a></div></>}</main></div>
  return <AuthBoundary site={site.data}>{children}</AuthBoundary>
}
