import { useState } from 'react'
import type { OrganizationBrand } from './site'

export function ProductBrand({ href = '/' }: { href?: string }) {
  return <a className="public-brand" href={href} aria-label="Ive POS home"><img src="/ive-pos-logo.svg" width="134" height="40" alt="Ive POS" /></a>
}
export function OrganizationLogo({ organization }: { organization: OrganizationBrand }) {
  const [failed, setFailed] = useState(false)
  return <div className="organization-logo">{organization.image_url && !failed
    ? <img src={organization.image_url} alt={`${organization.name} logo`} onError={() => setFailed(true)} referrerPolicy="no-referrer" />
    : <span aria-label={`${organization.name} initials`}>{organization.name.split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase()}</span>}</div>
}
