import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Building2, Check, Eye, EyeOff, Globe, LockKeyhole, MapPin, RefreshCw, ShieldCheck, Store, Users } from 'lucide-react'
import { platformRequest } from './platform-api'
import { usePlatformStepUp } from './PlatformStepUp'
import { LocationMapPicker } from './ControlPanels'
import type { ProvisionedOwner } from './ControlPanels'
import { tenantBaseDomain, workspaceUrl } from './public/host'
import './organization-create.css'

type Draft = {
  name: string; slug: string; image_url: string; store_limit: string; employee_limit: string; organization_type: 'retail' | 'wholesale' | 'other'
  location_label: string; latitude: number | null; longitude: number | null; website_url: string
  owner_name: string; owner_email: string; owner_email_confirmed: boolean; owner_temporary_password: string; owner_phone: string; owner_title: string
}
function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*+-_'
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), byte => alphabet[byte % alphabet.length]).join('')
}
function suggestedSlug(name: string) {
  const slug = Array.from(name.normalize('NFKD')).filter(character => character.charCodeAt(0) < 128).join('').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/g, '') || 'store'
  try { workspaceUrl(slug); return slug } catch { return `${slug}-store` }
}
function Logo({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState('')
  let safe = false
  try { const parsed = new URL(url); safe = ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password } catch { /* Use initials until a complete URL is entered. */ }
  return <span className="org-create-logo">{safe && failed !== url ? <img src={url} alt="" onError={() => setFailed(url)} /> : name.trim() ? name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() : <Building2 size={24} aria-hidden="true" />}</span>
}

export default function InviteOrganization({ close, created }: { close: () => void; created: (credentials: ProvisionedOwner) => void }) {
  const cache = useQueryClient()
  const runCritical = usePlatformStepUp()
  const title = useRef<HTMLHeadingElement>(null)
  const [step, setStep] = useState(1)
  const [showMap, setShowMap] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Draft>(() => ({
    name: '', slug: '', image_url: '', store_limit: '1', employee_limit: '5', organization_type: 'retail',
    location_label: '', latitude: null, longitude: null, website_url: '', owner_name: '', owner_email: '', owner_email_confirmed: false,
    owner_temporary_password: temporaryPassword(), owner_phone: '', owner_title: '',
  }))
  const slug = draft.slug.trim() || suggestedSlug(draft.name)
  const address = `${slug}.${tenantBaseDomain}`
  function update<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft(current => ({ ...current, [key]: value, ...(key === 'owner_email' ? { owner_email_confirmed: false } : {}) })); setError('') }
  function go(next: number) {
    setStep(next); setError('')
    document.querySelector('.controller-main')?.scrollTo({ top: 0 })
    requestAnimationFrame(() => title.current?.focus())
  }
  function valid(form: HTMLFormElement) {
    const invalid = form.querySelector<HTMLInputElement>('input:invalid, select:invalid, textarea:invalid')
    if (invalid) { const details = invalid.closest('details'); if (details) details.open = true }
    return form.reportValidity()
  }
  function businessError() {
    if (!draft.name.trim() || !draft.location_label.trim()) return 'Enter an organization name and location.'
    if ((draft.latitude === null) !== (draft.longitude === null)) return 'Enter both coordinates, or clear the map pin.'
    for (const value of [draft.image_url, draft.website_url]) {
      if (value.trim()) { try { const url = new URL(value.trim()); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return 'Use an http or https URL without embedded credentials.' } catch { return 'Enter a valid logo or website URL.' } }
    }
    if (draft.slug.trim()) { try { workspaceUrl(draft.slug) } catch { return 'This sign-in address is reserved or invalid. Use letters, numbers, and hyphens.' } }
    return ''
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !valid(event.currentTarget)) return
    const problem = businessError()
    if (problem) { if (step !== 1) go(1); setError(problem); return }
    if (step === 1) { go(2); return }
    if (!draft.owner_name.trim()) { setError('Enter the administrator’s name.'); return }
    setBusy(true); setError('')
    const payload = { ...draft, name: draft.name.trim(), slug: draft.slug.trim(), location_label: draft.location_label.trim(),
      image_url: draft.image_url.trim(), website_url: draft.website_url.trim(), owner_name: draft.owner_name.trim(),
      owner_email: draft.owner_email.trim().toLowerCase(), owner_phone: draft.owner_phone.trim(), owner_title: draft.owner_title.trim(),
      store_limit: Number(draft.store_limit), employee_limit: Number(draft.employee_limit) }
    try {
      await runCritical(async () => {
        const result = await platformRequest('organizations', 'POST', payload) as { id: string; login_url: string }
        await cache.invalidateQueries({ queryKey: ['platform-organizations'] })
        created({ id: result.id, login_url: result.login_url, organization: payload.name, email: payload.owner_email, temporaryPassword: payload.owner_temporary_password })
      })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create organization.') }
    finally { setBusy(false) }
  }
  return <div className="org-create-page">
    <button className="back-link icon-button org-create-back" disabled={busy} onClick={close}><ArrowLeft size={15} aria-hidden="true" />Organizations</button>
    <header className="org-create-heading"><span className="org-create-kicker">Platform / New workspace</span><h1>Onboard organization</h1><p>A business, an administrator, and you’re ready.</p></header>
    <div className="org-create-layout">
      <form className="org-create-form" noValidate onSubmit={submit} aria-label="Organization onboarding" aria-busy={busy}>
        <fieldset disabled={busy} className="org-create-fieldset">
          <ol className="org-create-steps" aria-label="Onboarding steps">
            <li aria-current={step === 1 ? 'step' : undefined} className={step === 1 ? 'current' : 'complete'}><button type="button" onClick={() => go(1)}><span>{step === 2 ? <Check size={14} aria-hidden="true" /> : '01'}</span>Business</button></li>
            <li aria-current={step === 2 ? 'step' : undefined} className={step === 2 ? 'current' : ''}><span className="org-create-step-number">02</span>Administrator</li>
          </ol>
          <div className="org-create-section-title"><span className="org-create-kicker">Step {step} of 2</span><h2 tabIndex={-1} ref={title}>{step === 1 ? 'Start with the business' : 'Who will run this workspace?'}</h2><p>{step === 1 ? 'The essentials first. You can add the finer details below.' : 'Create the owner account with a temporary sign-in password.'}</p></div>
          {step === 1 ? <>
            <div className="org-create-fields">
              <label className="org-create-wide">Organization name<input name="name" value={draft.name} onChange={e => update('name', e.target.value)} required maxLength={160} placeholder="e.g. Mountain Mart" autoComplete="organization" /></label>
              <label>Location / address<input name="location_label" value={draft.location_label} onChange={e => update('location_label', e.target.value)} required maxLength={240} placeholder="City, neighborhood, or street address" autoComplete="street-address" /></label>
              <label>Business type<select name="organization_type" value={draft.organization_type} onChange={e => update('organization_type', e.target.value as Draft['organization_type'])}><option value="retail">Retail</option><option value="wholesale">Wholesale</option><option value="other">Other</option></select></label>
            </div>
            <section className="org-create-capacity" aria-labelledby="create-capacity-title"><div><h3 id="create-capacity-title">Workspace capacity</h3><span>Set the allowances for this business.</span></div><div className="org-create-presets">{[{ label: 'Small team', stores: '1', users: '5' }, { label: 'Growing team', stores: '3', users: '20' }].map(preset => <button type="button" key={preset.label} aria-pressed={draft.store_limit === preset.stores && draft.employee_limit === preset.users} onClick={() => { setDraft(current => ({ ...current, store_limit: preset.stores, employee_limit: preset.users })); setError('') }}><strong>{preset.label}</strong><span>{preset.stores} {preset.stores === '1' ? 'store' : 'stores'} · {preset.users} employee seats</span></button>)}</div><div className="org-create-fields"><label>Store allowance<input name="store_limit" type="number" min="1" max="10000" value={draft.store_limit} onChange={e => update('store_limit', e.target.value)} required /></label><label>Employee seats<input name="employee_limit" type="number" min="1" max="100000" value={draft.employee_limit} onChange={e => update('employee_limit', e.target.value)} required /></label></div></section>
            <details key="business-options" className="org-create-options"><summary>Branding, website & location pin<span>Optional</span></summary><div className="org-create-fields">
              <label className="org-create-wide">Custom sign-in address<div className="org-create-address"><input name="slug" value={draft.slug} onChange={e => update('slug', e.target.value.toLowerCase())} placeholder={suggestedSlug(draft.name)} pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?" maxLength={63} autoComplete="off" autoCapitalize="none" spellCheck={false} /><span>.{tenantBaseDomain}</span></div><small>Leave blank to assign an address from the business name.</small></label>
              <label className="org-create-wide">Logo URL<input name="image_url" type="url" value={draft.image_url} onChange={e => update('image_url', e.target.value)} placeholder="https://example.com/logo.png" maxLength={1000} /><small>Use a publicly accessible image.</small></label>
              <label className="org-create-wide">Website<input name="website_url" type="url" value={draft.website_url} onChange={e => update('website_url', e.target.value)} placeholder="https://example.com" maxLength={300} /></label>
              <label className="org-create-check org-create-wide"><input type="checkbox" checked={showMap} onChange={e => { setShowMap(e.target.checked); if (!e.target.checked) setDraft(current => ({ ...current, latitude: null, longitude: null })); setError('') }} /><span>Add a location pin</span></label>
              {showMap && <div className="org-create-wide"><LocationMapPicker latitude={draft.latitude} longitude={draft.longitude} select={(latitude, longitude, placeName) => { setDraft(current => ({ ...current, latitude, longitude, ...(placeName ? { location_label: placeName } : {}) })); setError('') }} /></div>}
            </div></details>
          </> : <>
            <div className="org-create-fields">
              <label className="org-create-wide">Administrator name<input name="owner_name" value={draft.owner_name} onChange={e => update('owner_name', e.target.value)} required maxLength={160} autoComplete="name" placeholder="Full name" /></label>
              <label className="org-create-wide">Administrator email<input name="owner_email" type="email" value={draft.owner_email} onChange={e => update('owner_email', e.target.value)} required maxLength={254} autoComplete="email" placeholder="owner@business.com" /></label>
              <label className="org-create-check org-create-email-check org-create-wide"><input name="owner_email_confirmed" type="checkbox" checked={draft.owner_email_confirmed} onChange={e => update('owner_email_confirmed', e.target.checked)} required /><span>I confirmed this administrator’s email address through our onboarding process.</span></label>
            </div>
            <div className="org-create-password-note"><LockKeyhole size={19} aria-hidden="true" /><div><strong>Temporary password is ready</strong><span>The administrator chooses a new password at first sign-in. You’ll receive the sign-in details after creation.</span></div></div>
            <details key="admin-options" className="org-create-options"><summary>Contact & sign-in details<span>Optional</span></summary><div className="org-create-fields"><label>Phone number<input name="owner_phone" type="tel" value={draft.owner_phone} onChange={e => update('owner_phone', e.target.value)} maxLength={40} autoComplete="tel" /></label><label>Role / title<input name="owner_title" value={draft.owner_title} onChange={e => update('owner_title', e.target.value)} maxLength={100} placeholder="Administrator" /></label><label className="org-create-wide">Temporary password<div className="org-create-password"><input name="owner_temporary_password" type={showPassword ? 'text' : 'password'} value={draft.owner_temporary_password} onChange={e => update('owner_temporary_password', e.target.value)} required minLength={15} maxLength={128} autoComplete="new-password" /><button type="button" aria-label={showPassword ? 'Hide temporary password' : 'Show temporary password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button><button type="button" aria-label="Generate new temporary password" onClick={() => update('owner_temporary_password', temporaryPassword())}><RefreshCw size={16} /></button></div><small>Generated automatically. You can replace it with 15–128 characters.</small></label></div></details>
            <div className="org-create-ready"><Check size={16} aria-hidden="true" /><span>Creates the workspace and its administrator account.</span></div>
          </>}
        </fieldset>
        {error && <p role="alert" className="org-create-error">{error}</p>}
        <footer className="org-create-actions"><button type="button" className="secondary-button" disabled={busy} onClick={() => step === 1 ? close() : go(1)}>{step === 1 ? 'Cancel' : 'Back'}</button><button className="primary-button" disabled={busy}>{busy ? 'Creating…' : step === 1 ? 'Continue to administrator' : 'Create organization'}{step === 1 ? <ArrowRight size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}</button></footer>
      </form>
      <aside className="org-create-preview" aria-label="Live organization preview">
        <div className="org-create-preview-heading"><span className="org-create-kicker">Workspace preview</span><span><span aria-hidden="true" />Live</span></div>
        <div className="org-create-browser"><Globe size={13} aria-hidden="true" /><span>{draft.name.trim() || draft.slug.trim() ? address : `your-business.${tenantBaseDomain}`}</span><LockKeyhole size={12} aria-hidden="true" /></div>
        <div className="org-create-signin"><Logo url={draft.image_url.trim()} name={draft.name} /><span className="org-create-business-type">{draft.organization_type}</span><h3>{draft.name.trim() || 'Your business'}</h3><p>Your business workspace</p><div className="org-create-preview-login"><span>Administrator email</span><div>{draft.owner_email.trim() || 'owner@business.com'}</div><span>Password</span><div className="org-create-preview-dots">••••••••••••</div><div className="org-create-preview-button">Sign in<ArrowRight size={14} aria-hidden="true" /></div></div></div>
        <div className="org-create-preview-meta"><div><MapPin size={15} aria-hidden="true" /><span>{draft.location_label.trim() || 'Location to be added'}</span></div><div><Store size={15} aria-hidden="true" /><span>{draft.store_limit || '—'} {draft.store_limit === '1' ? 'store' : 'stores'}</span><Users size={15} aria-hidden="true" /><span>{draft.employee_limit || '—'} employee seats</span></div>{draft.owner_name.trim() && <div><ShieldCheck size={15} aria-hidden="true" /><span>{draft.owner_name.trim()} · Administrator</span></div>}</div>
        <p className="org-create-preview-note">Preview only. The final sign-in address is confirmed on creation.</p>
      </aside>
    </div>
  </div>
}
