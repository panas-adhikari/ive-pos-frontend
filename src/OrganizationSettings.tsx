import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOrganizationStepUp } from './PlatformStepUp'
import { setupRequest } from './organization-api'
import type { Business, Setup } from './StoreSetup'
import { appLoginUrl, workspaceUrl } from './public/host'
import { navigate } from './navigation'
import './organization-settings.css'

const fields = ['name', 'organization_type', 'location_label', 'contact_email', 'phone', 'image_url', 'website_url', 'currency', 'timezone', 'receipt_footer'] as const
type Draft = Record<typeof fields[number], string>
function details(org: Business): Draft {
  return Object.fromEntries(fields.map(key => [key, org[key] || ''])) as Draft
}
function Logo({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState('')
  return url && failed !== url ? <img className="org-settings-logo" src={url} alt={`${name || 'Organization'} logo`} referrerPolicy="no-referrer" onError={() => setFailed(url)} />
    : <span className="org-settings-logo org-settings-monogram" aria-label="Organization initials">{name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'O'}</span>
}

export default function OrganizationSettings({ data, reload }: { data: Setup; reload: () => Promise<void> }) {
  const [saved, setSaved] = useState(data.organization)
  const [draft, setDraft] = useState(() => details(data.organization))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [requestOpen, setRequestOpen] = useState(false)
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [requestMessage, setRequestMessage] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const cache = useQueryClient()
  const runCritical = useOrganizationStepUp()
  const dirty = JSON.stringify(draft) !== JSON.stringify(details(saved))
  const loginUrl = saved.login_url || (saved.subdomain_enabled && saved.slug ? workspaceUrl(saved.slug) : appLoginUrl)
  useEffect(() => {
    if (!dirty) return
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = '' }
    function warnNavigation(event: Event) {
      if (!window.confirm('Leave settings and discard your unsaved changes?')) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    window.addEventListener('ivepos:before-navigation', warnNavigation)
    return () => {
      window.removeEventListener('beforeunload', warn)
      window.removeEventListener('ivepos:before-navigation', warnNavigation)
    }
  }, [dirty])
  function change(key: keyof Draft, value: string) { setDraft(current => ({ ...current, [key]: value })); setMessage('') }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      await runCritical(async () => {
        const result: Business = await setupRequest(`${saved.id}/settings`, 'PUT', { ...draft, expected_version: saved.version })
        setSaved(result); setDraft(details(result)); setMessage('Organization settings saved.')
        await cache.invalidateQueries({ queryKey: ['store-setup', saved.id] })
        await cache.invalidateQueries({ queryKey: ['identity'] })
      })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save settings. Your changes are still here.') }
    finally { setBusy(false) }
  }
  async function loadLatest() {
    if (dirty && !window.confirm('Discard your unsaved changes and load the latest organization settings?')) return
    setBusy(true); setError('')
    try {
      const latest: Setup = await setupRequest(`${saved.id}/setup`)
      setSaved(latest.organization); setDraft(details(latest.organization)); await reload()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to reload settings.') }
    finally { setBusy(false) }
  }
  async function requestStores(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const values = new FormData(event.currentTarget)
    setRequestBusy(true); setRequestError(''); setRequestMessage('')
    try {
      await setupRequest(`${saved.id}/store-limit-requests`, 'POST', { requested_limit: Number(values.get('requested_limit')), reason: String(values.get('reason')).trim() })
      setRequestOpen(false); setRequestMessage('Request sent to the platform team for review.')
    } catch (reason) { setRequestError(reason instanceof Error ? reason.message : 'Unable to send request.') }
    finally { setRequestBusy(false) }
  }
  const input = (key: keyof Draft, label: string, options: { type?: string; max?: number; placeholder?: string; required?: boolean; wide?: boolean } = {}) =>
    <label className={options.wide ? 'org-settings-wide' : undefined}>{label}<input name={key} value={draft[key]} onChange={event => change(key, event.target.value)} type={options.type || 'text'} maxLength={options.max} placeholder={options.placeholder} required={options.required} /></label>
  return <div className="org-settings">
    <header className="org-settings-intro"><div className="org-settings-identity"><Logo url={draft.image_url} name={draft.name} /><div><h3>{saved.name}</h3><p>Manage your business details and defaults for new stores.</p></div></div><span className={`org-settings-state ${saved.configured ? '' : 'pending'}`}>{saved.configured ? 'Configured' : 'Setup incomplete'}</span></header>
    <nav className="org-settings-nav" aria-label="Settings sections">{[['business', 'Business details'], ['branding', 'Contact & branding'], ['regional', 'Regional defaults'], ['receipts', 'Receipts']].map(([id, label]) => <a key={id} href={`#org-${id}`}>{label}</a>)}</nav>
    <div className="org-settings-layout">
      <form className="org-settings-form" onSubmit={save}>
        <fieldset disabled={busy}><legend className="sr-only">Organization details</legend>
          <section className="org-settings-section" id="org-business"><div className="org-settings-section-title"><span>01</span><div><h3>Business details</h3><p>The name and location that identify your organization.</p></div></div><div className="org-settings-fields">
            {input('name', 'Business name', { required: true, max: 160 })}
            <label>Business type<select name="organization_type" value={draft.organization_type} onChange={event => change('organization_type', event.target.value)}><option value="retail">Retail</option><option value="wholesale">Wholesale</option><option value="other">Other</option></select></label>
            {input('location_label', 'Business address', { max: 240, placeholder: 'Street, city and region', wide: true })}
          </div></section>
          <section className="org-settings-section" id="org-branding"><div className="org-settings-section-title"><span>02</span><div><h3>Contact & branding</h3><p>Keep your business contact information and identity up to date.</p></div></div><div className="org-settings-fields">
            {input('contact_email', 'Business contact email', { type: 'email', max: 254 })}{input('phone', 'Business phone', { type: 'tel', max: 40 })}
            {input('website_url', 'Website', { type: 'url', max: 300, placeholder: 'https://your-business.com' })}
            {input('image_url', 'Logo URL', { type: 'url', max: 1000, placeholder: 'https://your-business.com/logo.png' })}
          </div><p className="org-settings-note">Use a public image URL for your logo. Your preview updates as you edit.</p></section>
          <section className="org-settings-section" id="org-regional"><div className="org-settings-section-title"><span>03</span><div><h3>Regional defaults</h3><p>Set the currency and local timezone for your business.</p></div></div><div className="org-settings-fields">
            <label>Currency<select name="currency" value={draft.currency} onChange={event => change('currency', event.target.value)}>{data.currencies.map(code => <option key={code} value={code}>{code} · {new Intl.DisplayNames(['en'], { type: 'currency' }).of(code)}</option>)}</select></label>
            <label>Timezone<select name="timezone" value={draft.timezone} onChange={event => change('timezone', event.target.value)}>{data.timezones.map(zone => <option key={zone}>{zone}</option>)}</select></label>
          </div><p className="org-settings-note">New stores inherit this timezone. Existing stores keep their own settings.</p></section>
          <section className="org-settings-section" id="org-receipts"><div className="org-settings-section-title"><span>04</span><div><h3>Receipt defaults</h3><p>Add a message for your customers at the bottom of receipts.</p></div></div><label>Receipt footer<textarea name="receipt_footer" value={draft.receipt_footer} maxLength={500} rows={4} placeholder="Thank you for shopping with us!" onChange={event => change('receipt_footer', event.target.value)} /></label><div className="org-settings-footer-hint"><p>Applies to new stores. Edit existing receipts in store settings.</p><span>{draft.receipt_footer.length}/500</span></div></section>
        </fieldset>
        {error && <div className="org-settings-error" role="alert"><p>{error}</p><button type="button" className="secondary-button" disabled={busy} onClick={() => void loadLatest()}>Reload saved settings</button></div>}
        <div className="org-settings-save"><p role="status">{message || (dirty ? 'You have unsaved changes' : saved.configured ? 'All changes saved' : 'Confirm your details to finish setup')}</p><div><button type="button" className="secondary-button" disabled={busy || !dirty} onClick={() => { setDraft(details(saved)); setError(''); setMessage('Changes discarded.') }}>Discard</button><button className="primary-button" disabled={busy || (!dirty && saved.configured)}>{busy ? 'Saving…' : 'Save settings'}</button></div></div>
      </form>
      <aside className="org-settings-sidebar" aria-label="Workspace information">
        <section className="org-settings-card"><p className="org-settings-kicker">LIVE PREVIEW</p><h3>Receipt preview</h3><p className="org-settings-note">Sample receipt using your current edits.</p><div className="org-settings-receipt"><strong>{draft.name || 'Business name'}</strong>{[draft.location_label, draft.phone, draft.contact_email, draft.website_url].filter(Boolean).map((line, index) => <p key={index}>{line}</p>)}<div className="org-settings-receipt-total"><span>Sample total</span><strong>{new Intl.NumberFormat('en', { style: 'currency', currency: draft.currency || 'NPR' }).format(100)}</strong></div><p className="org-settings-receipt-footer">{draft.receipt_footer || 'Your receipt footer will appear here.'}</p></div></section>
        <section className="org-settings-card"><p className="org-settings-kicker">WORKSPACE ACCESS</p><h3>Sign-in address</h3><p className="org-settings-note">{saved.subdomain_enabled ? 'Your organization has a dedicated workspace address.' : 'Your organization uses the shared sign-in page.'}</p><a className="org-settings-url" href={loginUrl} target="_blank" rel="noreferrer">{loginUrl}</a><div className="org-settings-access-actions"><button type="button" className="secondary-button" onClick={async () => { try { await navigator.clipboard.writeText(loginUrl); setCopyMessage('Sign-in address copied.') } catch { setCopyMessage('Unable to copy. Select the address above to copy it.') } }}>Copy address</button><a href={loginUrl} target="_blank" rel="noreferrer">Open sign-in ↗</a></div>{copyMessage && <p role="status" className="org-settings-note">{copyMessage}</p>}<p className="org-settings-note">Contact your platform administrator to change your subdomain.</p><button type="button" className="org-settings-text-button" onClick={() => navigate('/profile')}>Profile & security →</button></section>
        <section className="org-settings-card"><p className="org-settings-kicker">WORKSPACE CAPACITY</p><h3>Stores & employees</h3><div className="org-settings-capacity"><span>Stores created</span><strong>{data.stores.length} / {saved.store_limit}</strong></div><progress aria-label="Store capacity used" value={data.stores.length} max={Math.max(saved.store_limit, data.stores.length, 1)} /><div className="org-settings-capacity"><span>Employee allowance</span><strong>{saved.employee_limit}</strong></div><p className="org-settings-note">Allowances are managed by your platform administrator.</p><button type="button" className="secondary-button" aria-expanded={requestOpen} disabled={requestBusy} onClick={() => { setRequestOpen(!requestOpen); setRequestError('') }}>Request more stores</button>
          {requestOpen && <form className="org-settings-request" onSubmit={requestStores}><label>Requested total stores<input type="number" name="requested_limit" min={saved.store_limit + 1} max={10000} defaultValue={saved.store_limit + 1} required disabled={requestBusy} /></label><label>Reason for request<textarea name="reason" minLength={10} maxLength={1000} rows={3} required disabled={requestBusy} /></label><button className="primary-button" disabled={requestBusy}>{requestBusy ? 'Sending…' : 'Send request'}</button></form>}
          {requestError && <p role="alert" className="org-settings-error">{requestError}</p>}{requestMessage && <p role="status" className="org-settings-note">{requestMessage}</p>}
        </section>
      </aside>
    </div>
  </div>
}
