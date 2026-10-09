import { apiUrl } from '../api-url'

export type OrganizationBrand = { id: string; name: string; slug: string; image_url: string; login_url: string }
export type Site = { organization: OrganizationBrand | null; platform_url: string; tenant_base_domain: string }
import { isOrganizationHost } from './host'
export { isOrganizationHost, tenantBaseDomain, workspaceUrl } from './host'
export async function loadSite(): Promise<Site> {
  const response = await fetch(apiUrl('/api/v1/public/site'), { credentials: 'include', signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error(response.status === 404 ? 'This store address isn’t registered.' : 'Store details could not be loaded.')
  const site = await response.json() as Site
  if (isOrganizationHost() && (!site.organization || window.location.hostname !== `${site.organization.slug}.${site.tenant_base_domain}`)) {
    throw new Error('This store address isn’t registered.')
  }
  return site
}
