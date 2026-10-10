import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Check, Copy, Globe, RefreshCw } from 'lucide-react'
import type { OrganizationDetail } from './ControlPanels'
import { platformRequest } from './platform-api'
import { usePlatformStepUp } from './PlatformStepUp'
import './organization-subdomain.css'

type Options = { domain: string; suggestions: { slug: string; available: boolean }[] }

export default function OrganizationSubdomain({ org, superAdmin }: { org: OrganizationDetail; superAdmin: boolean }) {
  const cache = useQueryClient()
  const runCritical = usePlatformStepUp()
  const options = useQuery<Options>({ queryKey: ['organization-subdomain-options', org.id, org.version], queryFn: () => platformRequest(`organizations/${org.id}/subdomain-options`), retry: false })
  const [enabled, setEnabled] = useState(org.subdomain_enabled)
  const [slug, setSlug] = useState(org.subdomain_enabled ? org.slug || '' : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const chosen = slug.trim().toLowerCase()
  const changed = enabled !== org.subdomain_enabled || enabled && chosen !== org.slug

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !changed) return
    setBusy(true); setError('')
    try {
      await runCritical(async () => {
        await platformRequest(`organizations/${org.id}/subdomain`, 'PUT', { enabled, slug: enabled ? chosen : null, expected_version: org.version })
        await Promise.all([
          cache.invalidateQueries({ queryKey: ['platform-organizations'] }),
          cache.invalidateQueries({ queryKey: ['platform-organization', org.id] }),
        ])
      })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save the subdomain.') }
    finally { setBusy(false) }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(org.login_url); setCopied(true) }
    catch { setError('Copy could not complete. Select and copy the sign-in address.') }
  }

  return <section className="platform-section organization-subdomain" id="organization-subdomain" aria-labelledby="subdomain-title">
    <div className="platform-section-heading"><div><span className="platform-kicker">WORKSPACE ACCESS</span><h2 id="subdomain-title">Subdomain</h2></div><span className="platform-status"><Globe size={13} aria-hidden="true" />{org.subdomain_enabled ? 'Enabled' : 'Optional'}</span></div>
    <div className="organization-login-address"><span className="platform-label">Current sign-in address</span><a href={org.login_url} target="_blank" rel="noreferrer">{org.login_url}<ArrowUpRight size={14} aria-hidden="true" /></a><button type="button" className="platform-text-button" onClick={() => void copy()}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? 'Copied' : 'Copy address'}</button></div>
    {options.isPending ? <p role="status" className="subdomain-help">Loading subdomain choices…</p> : options.isError ? <div><p role="alert" className="platform-form-error">{options.error.message}</p><button className="platform-text-button" onClick={() => void options.refetch()}><RefreshCw size={14} aria-hidden="true" />Try again</button></div> : superAdmin && !org.deletion_scheduled_for ? <form onSubmit={save}>
      <fieldset disabled={busy}>
        <label className="subdomain-toggle"><input type="checkbox" checked={enabled} disabled={!options.data.domain && !org.subdomain_enabled} onChange={event => { setEnabled(event.target.checked); setError(''); if (event.target.checked && !slug) setSlug(options.data.suggestions.find(item => item.available)?.slug || '') }} /><span>Use a dedicated sign-in address</span></label>
        <p className="subdomain-help">Choose a word from “{org.name}”, a prefix of at least two letters, or the name’s initials.</p>
        {!options.data.domain && <p role="status" className="subdomain-help">Dedicated sign-in addresses aren’t configured on this platform yet.</p>}
        {enabled && <>
          <label className="subdomain-input-label" htmlFor={`subdomain-${org.id}`}>Subdomain</label>
          <div className="subdomain-input"><input id={`subdomain-${org.id}`} name="subdomain" value={slug} onChange={event => { setSlug(event.target.value.toLowerCase()); setError('') }} required pattern="[a-z0-9]{1,63}" maxLength={63} autoComplete="off" autoCapitalize="none" spellCheck={false} aria-describedby={`subdomain-help-${org.id}`} /><span>.{options.data.domain}</span></div>
          <p id={`subdomain-help-${org.id}`} className="subdomain-help">Use one name word or a short form. Availability is confirmed when you save.</p>
          {options.data.suggestions.length > 0 && <div className="subdomain-suggestions" aria-label="Suggested subdomains">{options.data.suggestions.map(item => <button key={item.slug} type="button" disabled={!item.available} aria-pressed={chosen === item.slug} onClick={() => { setSlug(item.slug); setError('') }}>{item.slug}{!item.available && <span> · Taken</span>}</button>)}</div>}
        </>}
        {changed && org.subdomain_enabled && <p className="subdomain-help">Saving replaces the current address. Previous sign-in links will stop working.</p>}
        <div className="platform-form-actions"><button className="primary-button" disabled={!changed || enabled && !chosen}>{busy ? 'Saving…' : 'Save subdomain'}</button>{changed && <button type="button" className="secondary-button" onClick={() => { setEnabled(org.subdomain_enabled); setSlug(org.subdomain_enabled ? org.slug || '' : ''); setError('') }}>Cancel changes</button>}</div>
      </fieldset>
    </form> : <p className="subdomain-help">{org.subdomain_enabled ? 'This organization uses a dedicated sign-in address.' : 'This organization uses platform sign-in. A platform super admin can enable a subdomain.'}</p>}
    {error && <p role="alert" className="platform-form-error">{error}</p>}
  </section>
}
