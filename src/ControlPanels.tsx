import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, MouseEvent, PointerEvent } from 'react'
import { ArrowLeft, ArrowRight, Check, Copy, Mail, MapPin, RefreshCw, RotateCw, Trash2, UserPlus } from 'lucide-react'
import { platformRequest } from './platform-api'
import { OrganizationOnboarding } from './OrganizationOnboarding'
import { PlatformStepUpProvider, usePlatformStepUp } from './PlatformStepUp'
import './onboarding.css'

type Metric = { label: string; value: string; note: string; pending?: boolean }
type PlatformOrganization = { id: string; name: string; organization_type: string; image_url: string; location_label: string; configured: boolean; store_limit: number; employee_limit: number; active_employees: number; deletion_scheduled_for: string | null }
type OrganizationDetail = PlatformOrganization & { contact_email: string; phone: string; owner_name: string; owner_phone: string; owner_title: string; website_url: string; latitude: number | null; longitude: number | null; currency: string; timezone: string; stores: number; billing_tier: string | null; store_limit_requests: { id: string; created: string; current_limit: number; requested_limit: number; reason: string }[] }
type ProvisionedOwner = { id: string; organization: string; email: string; temporaryPassword: string }

function Metrics({ items }: { items: Metric[] }) {
  return <div className="dashboard-grid">{items.map(item => <article className="metric-card" key={item.label}><p>{item.label}</p><strong>{item.value}</strong><small className={item.pending ? 'pending' : ''}>{item.note}</small></article>)}</div>
}

export function PlatformOverview({ superAdmin }: { superAdmin: boolean }) {
  return <PlatformStepUpProvider><PlatformOverviewContent superAdmin={superAdmin} /></PlatformStepUpProvider>
}

function PlatformOverviewContent({ superAdmin }: { superAdmin: boolean }) {
  const organizations = useQuery<PlatformOrganization[]>({ queryKey: ['platform-organizations'], queryFn: () => platformRequest('organizations'), retry: false })
  const rows = organizations.data || []
  const [inviting, setInviting] = useState(false)
  const [provisionedOwner, setProvisionedOwner] = useState<ProvisionedOwner | null>(null)
  const [selectedOrganization, setSelectedOrganization] = useState<string | null>(null)
  if (inviting) return <InviteOrganization close={() => setInviting(false)} created={credentials => { setProvisionedOwner(credentials); setInviting(false) }} />
  if (selectedOrganization) return <PlatformOrganizationDetail id={selectedOrganization} back={() => setSelectedOrganization(null)} superAdmin={superAdmin} />
  return <>
    <section className="panel"><div className="panel-heading compact-panel-heading"><h1>Organizations</h1><div className="compact-heading-actions"><button className="secondary-button icon-button" onClick={() => void organizations.refetch()}><RefreshCw aria-hidden="true" />Refresh</button>{superAdmin && <button className="primary-button icon-button" onClick={() => { setProvisionedOwner(null); setInviting(true) }}><UserPlus aria-hidden="true" />Onboard organization</button>}</div></div>{organizations.isPending ? <p className="muted">Loading organizations…</p> : organizations.isError ? <p role="alert">{organizations.error.message}</p> : !rows.length ? <p className="muted">No organizations yet.</p> : <ul className="location-list">{rows.map(row => <li key={row.id}><div className="platform-org-summary">{row.image_url ? <img src={row.image_url} alt="" /> : <span className="activity-icon">{row.name[0]}</span>}<span><strong>{row.name}</strong><small>{row.organization_type} · {row.location_label || 'Location not set'} · {row.deletion_scheduled_for ? `Deletion scheduled ${new Date(row.deletion_scheduled_for).toLocaleString()}` : `${row.configured ? 'Configured' : 'Setup pending'} · ${row.active_employees} / ${row.employee_limit} expected users`}</small></span></div><button className="secondary-button icon-button" onClick={() => setSelectedOrganization(row.id)}>Details<ArrowRight aria-hidden="true" /></button></li>)}</ul>}</section>
    {provisionedOwner && <OwnerCredentialsPopover owner={provisionedOwner} done={() => setProvisionedOwner(null)} />}
  </>
}

function PlatformOrganizationDetail({ id, back, superAdmin }: { id: string; back: () => void; superAdmin: boolean }) {
  const detail = useQuery<OrganizationDetail>({ queryKey: ['platform-organization', id], queryFn: () => platformRequest(`organizations/${id}`), retry: false })
  if (detail.isPending) return <p role="status">Loading organization details…</p>
  if (detail.isError) return <section className="panel"><p role="alert">{detail.error.message}</p><button className="secondary-button icon-button" onClick={back}><ArrowLeft aria-hidden="true" />Back to organizations</button></section>
  const org = detail.data
  return <>
    <div className="compact-page-bar"><button className="back-link icon-button" onClick={back}><ArrowLeft aria-hidden="true" />Organizations</button><span className="compact-page-divider" aria-hidden="true" /><h1>{org.name}</h1><span className={org.deletion_scheduled_for || !org.configured ? 'state waiting' : 'state'}>{org.deletion_scheduled_for ? 'Pending deletion' : org.configured ? 'Configured' : 'Pending setup'}</span></div>
    <p className="privacy-note">Platform access shows organization profile, contact and operational limits. Tenant records, credentials, customers, sales, inventory, and audit details are not exposed here.</p>
    <section className="panel onboarding-profile" aria-label="Organization profile">
      <div className="panel-heading">{org.image_url ? <img src={org.image_url} alt={`${org.name} logo`} /> : <h3>{org.name}</h3>}<span className="state">{org.organization_type}</span></div>
      <dl><dt>Location</dt><dd>{org.location_label || 'Not provided'}{org.latitude !== null && org.longitude !== null ? ` · ${org.latitude.toFixed(5)}, ${org.longitude.toFixed(5)}` : ''}</dd><dt>Website</dt><dd>{org.website_url ? <a href={org.website_url} target="_blank" rel="noreferrer">{org.website_url}</a> : 'Not provided'}</dd><dt>Administrator</dt><dd>{org.owner_name || 'Not provided'}{org.owner_title ? ` · ${org.owner_title}` : ''}</dd><dt>Admin contact</dt><dd>{org.contact_email}{org.owner_phone ? ` · ${org.owner_phone}` : ''}</dd></dl>
    </section>
    <Metrics items={[{ label: 'Active employees', value: `${org.active_employees} / ${org.employee_limit}`, note: 'Current seat usage' }, { label: 'Stores', value: `${org.stores} / ${org.store_limit}`, note: 'Current locations' }, { label: 'Billing tier', value: org.billing_tier || 'Not assigned', note: 'Packages coming later', pending: true }, { label: 'Currency', value: org.currency, note: org.timezone }]} />
    {!!org.store_limit_requests?.length && <section className="panel store-limit-inbox"><div className="panel-heading"><h3>Store allowance requests</h3><span className="state waiting">Review requested</span></div><ul>{org.store_limit_requests.map(item => <li key={item.id}><strong>{item.current_limit} → {item.requested_limit} stores</strong><small>{new Date(item.created).toLocaleDateString()}</small><p>{item.reason}</p></li>)}</ul><p className="muted">Use Platform controls below to change the store allowance after review.</p></section>}
    <div className="dashboard-columns"><section className="panel"><div className="panel-heading"><h3>Direct contact</h3><span className="demo-label">ORGANIZATION CONTACT</span></div><dl className="detail-list"><dt>Main email</dt><dd><a href={`mailto:${org.contact_email}`}>{org.contact_email || 'Not provided'}</a></dd><dt>Phone</dt><dd><a href={`tel:${org.phone}`}>{org.phone || 'Not provided'}</a></dd><dt>Timezone</dt><dd>{org.timezone}</dd></dl></section><section className="panel"><div className="panel-heading"><h3>Platform controls</h3><span className="state">{superAdmin ? 'Super Admin' : 'View only'}</span></div>{superAdmin ? <><p className="muted">Set commercial limits for this organization. Billing tiers will be added here with packages.</p><LimitEditor row={org} /></> : <p className="muted">Only a Platform Super Admin can change commercial limits.</p>}<button className="secondary-button icon-button" onClick={back}><ArrowLeft aria-hidden="true" />Back to organizations</button></section></div>
    {superAdmin && <DeleteOrganization row={org} deleted={back} />}
  </>
}

function DeleteOrganization({ row, deleted }: { row: OrganizationDetail; deleted: () => void }) {
  const cache = useQueryClient()
  const runCritical = usePlatformStepUp()
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget)
    try { const verified = await runCritical(async () => {
      try {
        const result = await platformRequest(`organizations/${row.id}`, 'DELETE', { confirm_name: form.get('confirm_name') }) as { status: string }
        await cache.invalidateQueries({ queryKey: ['platform-organizations'] })
        await cache.invalidateQueries({ queryKey: ['platform-organization', row.id] })
        if (result.status === 'deleted') deleted(); else setOpen(false)
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete organization.') }
      finally { setBusy(false) }
    }); if (!verified) setBusy(false) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to verify your identity.'); setBusy(false) }
  }
  async function cancel() {
    setBusy(true); setError('')
    try { const verified = await runCritical(async () => {
      try {
        await platformRequest(`organizations/${row.id}/deletion/cancel`, 'POST', {})
        await cache.invalidateQueries({ queryKey: ['platform-organizations'] })
        await cache.invalidateQueries({ queryKey: ['platform-organization', row.id] })
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to cancel deletion.') }
      finally { setBusy(false) }
    }); if (!verified) setBusy(false) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to verify your identity.'); setBusy(false) }
  }
  return <section className="panel danger-zone"><div className="panel-heading"><div><h3>Delete organization</h3><p className="muted">Production keeps the organization for 30 days before permanently deleting its stores, registers, employees, invitations, and tenant audit records. Development mode deletes it immediately.</p></div></div>
    {row.deletion_scheduled_for ? <><p>Scheduled for <strong>{new Date(row.deletion_scheduled_for).toLocaleString()}</strong>.</p><button className="secondary-button" disabled={busy} onClick={() => void cancel()}>{busy ? 'Cancelling…' : 'Cancel deletion'}</button></> : !open ? <button className="danger-button icon-button" onClick={() => setOpen(true)}><Trash2 aria-hidden="true" />Delete organization</button> : <form onSubmit={remove} className="delete-form"><label>Type <strong>{row.name}</strong> to confirm<input name="confirm_name" required autoComplete="off" /></label>{error && <p role="alert">{error}</p>}<div className="action-row"><button className="danger-button" disabled={busy}>{busy ? 'Deleting…' : 'Confirm deletion'}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => { setOpen(false); setError('') }}>Cancel</button></div></form>}
    {error && !open && <p role="alert">{error}</p>}
  </section>
}

type OrganizationDraft = {
  name: string; image_url: string; store_limit: string; employee_limit: string; organization_type: 'retail' | 'wholesale' | 'other'
  location_label: string; latitude: number | null; longitude: number | null; website_url: string
  owner_name: string; owner_email: string; owner_email_confirmed: boolean; owner_temporary_password: string; owner_phone: string; owner_title: string
}

function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*+-_'
  const random = new Uint8Array(24)
  window.crypto.getRandomValues(random)
  return Array.from(random, byte => alphabet[byte % alphabet.length]).join('')
}

function InviteOrganization({ close, created }: { close: () => void; created: (credentials: ProvisionedOwner) => void }) {
  const cache = useQueryClient()
  const runCritical = usePlatformStepUp()
  const [step, setStep] = useState(1)
  const [showMap, setShowMap] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<OrganizationDraft>({
    name: '', image_url: '', store_limit: '1', employee_limit: '5', organization_type: 'retail',
    location_label: '', latitude: null, longitude: null, website_url: '', owner_name: '', owner_email: '', owner_email_confirmed: false,
    owner_temporary_password: temporaryPassword(), owner_phone: '', owner_title: '',
  })
  function update<K extends keyof OrganizationDraft>(key: K, value: OrganizationDraft[K]) {
    setDraft(current => ({ ...current, [key]: value }))
  }
  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step === 1 && (draft.latitude === null) !== (draft.longitude === null)) {
      setError('Enter both coordinates, or clear them to continue with the address only.')
      return
    }
    setError(''); setStep(value => Math.min(3, value + 1))
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const payload = {
      ...draft,
      store_limit: Number(draft.store_limit),
      employee_limit: Number(draft.employee_limit),
      owner_email_confirmed: draft.owner_email_confirmed,
    }
    try {
      const verified = await runCritical(async () => {
        try {
          const result = await platformRequest('organizations', 'POST', payload) as { id: string }
          await cache.invalidateQueries({ queryKey: ['platform-organizations'] })
          created({ id: result.id, organization: draft.name, email: draft.owner_email, temporaryPassword: draft.owner_temporary_password })
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create organization.') }
        finally { setBusy(false) }
      })
      if (!verified) setBusy(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to verify your identity.'); setBusy(false) }
  }
  return <>
    <div className="compact-page-bar"><button className="back-link icon-button" disabled={busy} onClick={close}><ArrowLeft aria-hidden="true" />Organizations</button><span className="compact-page-divider" aria-hidden="true" /><h1>Onboard organization</h1></div>
    <section className="panel invite-page onboarding-wizard">
      <ol className="onboarding-steps" aria-label="Onboarding steps">
        {['Organization info', 'Organization admin', 'Final check'].map((label, index) => <li key={label} className={step === index + 1 ? 'current' : step > index + 1 ? 'complete' : ''}><span>{step > index + 1 ? <Check size={15} /> : index + 1}</span>{label}</li>)}
      </ol>
      <form onSubmit={step === 3 ? create : next} className="invite-form">
        {step === 1 && <div className="onboarding-fields">
          <label className="onboarding-wide">Organization name<input value={draft.name} onChange={e => update('name', e.target.value)} required maxLength={160} autoFocus /></label>
          <label>Organization image URL <span className="field-hint">Optional · publicly accessible image</span><input type="url" value={draft.image_url} onChange={e => update('image_url', e.target.value)} placeholder="https://example.com/logo.png" maxLength={1000} /></label>
          <div className="org-image-preview">{draft.image_url ? <img key={draft.image_url} src={draft.image_url} alt="Organization preview" /> : <span>{draft.name.trim().charAt(0).toUpperCase() || 'O'}</span>}</div>
          <label>Number of stores<input type="number" value={draft.store_limit} onChange={e => update('store_limit', e.target.value)} min="1" max="10000" required /></label>
          <label>Expected users / employees<input type="number" value={draft.employee_limit} onChange={e => update('employee_limit', e.target.value)} min="1" max="100000" required /></label>
          <label>Organization type<select value={draft.organization_type} onChange={e => update('organization_type', e.target.value as OrganizationDraft['organization_type'])}><option value="retail">Retail</option><option value="wholesale">Wholesale</option><option value="other">Other</option></select></label>
          <label>Website <span className="field-hint">Optional</span><input type="url" value={draft.website_url} onChange={e => update('website_url', e.target.value)} placeholder="https://example.com" maxLength={300} /></label>
          <label className="onboarding-wide">Location / address<input value={draft.location_label} onChange={e => update('location_label', e.target.value)} required maxLength={240} placeholder="City, neighborhood, or street address" /></label>
          <label className="onboarding-map-option onboarding-wide"><input type="checkbox" checked={showMap} onChange={e => { const enabled = e.target.checked; setShowMap(enabled); if (!enabled) setDraft(current => ({ ...current, latitude: null, longitude: null })); setError('') }} /><span><strong>Select location from map</strong><small>Optional. The address above is enough to continue.</small></span></label>
          {showMap && <div className="onboarding-wide"><LocationMapPicker latitude={draft.latitude} longitude={draft.longitude} select={(latitude, longitude, placeName) => { setDraft(current => ({ ...current, latitude, longitude, ...(placeName ? { location_label: placeName } : {}) })); setError('') }} /></div>}
          {showMap && draft.latitude !== null && draft.longitude !== null && <p className="coordinate-readout onboarding-wide"><MapPin size={15} />Pin selected · {draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)}</p>}
        </div>}
        {step === 2 && <div className="onboarding-fields">
          <label>Administrator name<input value={draft.owner_name} onChange={e => update('owner_name', e.target.value)} required maxLength={160} autoFocus /></label>
          <label>Administrator email<input type="email" value={draft.owner_email} onChange={e => update('owner_email', e.target.value)} required maxLength={254} autoComplete="email" /></label>
          <label className="owner-email-confirm"><input type="checkbox" checked={draft.owner_email_confirmed} onChange={e => update('owner_email_confirmed', e.target.checked)} required /><span>I confirmed this administrator’s email address through our onboarding process.</span></label>
          <label className="onboarding-wide">Temporary password <span className="field-hint">Generated for you · editable · 24 characters</span><div className="generated-password"><input type="text" value={draft.owner_temporary_password} onChange={e => update('owner_temporary_password', e.target.value)} required minLength={15} maxLength={128} autoComplete="new-password" /><button type="button" className="secondary-button" onClick={() => update('owner_temporary_password', temporaryPassword())}><RotateCw size={15} />Generate new</button></div></label>
          <label>Phone number <span className="field-hint">Optional</span><input type="tel" value={draft.owner_phone} onChange={e => update('owner_phone', e.target.value)} maxLength={40} /></label>
          <label>Role / title <span className="field-hint">Optional</span><input value={draft.owner_title} onChange={e => update('owner_title', e.target.value)} maxLength={100} placeholder="Organization administrator" /></label>
          <p className="provisioning-hint onboarding-wide">The administrator will be required to choose a permanent password the first time they sign in.</p>
        </div>}
        {step === 3 && <div className="onboarding-review">
          <div className="review-org-heading">{draft.image_url ? <img src={draft.image_url} alt="" /> : <span>{draft.name.trim().charAt(0).toUpperCase() || 'O'}</span>}<div><p className="eyebrow">ORGANIZATION</p><h2>{draft.name}</h2><p>{draft.organization_type} · {draft.location_label}</p></div></div>
          <dl className="review-grid"><dt>Stores</dt><dd>{draft.store_limit}</dd><dt>Expected users</dt><dd>{draft.employee_limit}</dd><dt>Website</dt><dd>{draft.website_url || 'Not provided'}</dd>{draft.latitude !== null && draft.longitude !== null && <><dt>Map pin</dt><dd>{draft.latitude.toFixed(5)}, {draft.longitude.toFixed(5)}</dd></>}</dl>
          <div className="review-admin"><p className="eyebrow">ORGANIZATION ADMIN</p><strong>{draft.owner_name}</strong><span>{draft.owner_title || 'Administrator'} · {draft.owner_email}</span><span>{draft.owner_phone || 'No phone provided'}</span><span>Email address confirmed</span></div>
          <div className="review-password"><span>Temporary password</span><code>{draft.owner_temporary_password}</code><small>Shown once after creation. You can email it to the administrator from the confirmation popover.</small></div>
        </div>}
        {error && <p role="alert" className="onboarding-error">{error}</p>}
        <div className="action-row onboarding-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={() => step === 1 ? close() : setStep(value => value - 1)}>{step === 1 ? 'Cancel' : 'Back'}</button>
          {step < 3 ? <button className="primary-button" disabled={busy}>Continue<ArrowRight size={16} /></button> : <button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create organization'}<UserPlus size={16} /></button>}
        </div>
      </form>
    </section>
  </>
}

type CityResult = { name: string; latitude: number; longitude: number }

function LocationMapPicker({ latitude, longitude, select }: { latitude: number | null; longitude: number | null; select: (latitude: number | null, longitude: number | null, placeName?: string) => void }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; centerX: number; centerY: number; moved: boolean } | null>(null)
  const [size, setSize] = useState({ width: 720, height: 340 })
  const [zoom, setZoom] = useState(2)
  const [center, setCenter] = useState({ latitude: 20, longitude: 0 })
  const [cityQuery, setCityQuery] = useState('')
  const [cityResults, setCityResults] = useState<CityResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const worldSize = 256 * 2 ** zoom
  const centerX = (center.longitude + 180) / 360 * worldSize
  const centerY = mercatorY(center.latitude, worldSize)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const resize = new ResizeObserver(entries => {
      const bounds = entries[0]?.contentRect
      if (bounds) setSize({ width: bounds.width, height: bounds.height })
    })
    resize.observe(map)
    return () => resize.disconnect()
  }, [])
  useEffect(() => {
    if (latitude !== null && longitude !== null) setCenter({ latitude, longitude })
  }, [latitude, longitude])
  const firstX = Math.floor((centerX - size.width / 2) / 256)
  const firstY = Math.floor((centerY - size.height / 2) / 256)
  const columns = Math.ceil(size.width / 256) + 2
  const rows = Math.ceil(size.height / 256) + 2
  const tileCount = 2 ** zoom
  const tiles = []
  for (let y = firstY; y < firstY + rows; y++) for (let x = firstX; x < firstX + columns; x++) {
    if (y < 0 || y >= tileCount) continue
    const wrappedX = ((x % tileCount) + tileCount) % tileCount
    tiles.push({ x, y, wrappedX, left: x * 256 - (centerX - size.width / 2), top: y * 256 - (centerY - size.height / 2) })
  }
  const marker = latitude === null || longitude === null ? null : {
    left: (longitude + 180) / 360 * worldSize - (centerX - size.width / 2),
    top: mercatorY(latitude, worldSize) - (centerY - size.height / 2),
  }
  function click(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button, a')) return
    if (drag.current?.moved) { drag.current = null; return }
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = centerX + event.clientX - bounds.left - bounds.width / 2
    const y = centerY + event.clientY - bounds.top - bounds.height / 2
    const longitudeValue = x / worldSize * 360 - 180
    const latitudeValue = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / worldSize))) * 180 / Math.PI
    const pickedLatitude = Number(Math.max(-85.0511, Math.min(85.0511, latitudeValue)).toFixed(5))
    const pickedLongitude = Number((((longitudeValue + 540) % 360) - 180).toFixed(5))
    select(pickedLatitude, pickedLongitude)
    setCenter({ latitude: pickedLatitude, longitude: pickedLongitude })
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest('button, a')) return
    drag.current = { x: event.clientX, y: event.clientY, centerX, centerY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function pointerMove(event: MouseEvent<HTMLDivElement>) {
    const start = drag.current
    if (!start) return
    const dx = event.clientX - start.x, dy = event.clientY - start.y
    if (Math.abs(dx) + Math.abs(dy) > 3) start.moved = true
    if (!start.moved) return
    const movedX = start.centerX - dx
    const movedY = Math.max(0, Math.min(worldSize, start.centerY - dy))
    const longitudeValue = movedX / worldSize * 360 - 180
    const latitudeValue = Math.atan(Math.sinh(Math.PI * (1 - 2 * movedY / worldSize))) * 180 / Math.PI
    setCenter({ latitude: Math.max(-85.0511, Math.min(85.0511, latitudeValue)), longitude: longitudeValue })
  }
  function pointerUp() {
    if (!drag.current?.moved) drag.current = null
    else setTimeout(() => { drag.current = null }, 0)
  }
  function changeZoom(amount: number, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    setZoom(value => Math.max(1, Math.min(18, value + amount)))
  }
  async function searchCity() {
    if (cityQuery.trim().length < 2) return
    setSearching(true); setSearchError(''); setCityResults([])
    try {
      const response = await platformRequest(`geocode?q=${encodeURIComponent(cityQuery.trim())}`) as { results: CityResult[] }
      setCityResults(response.results)
      if (!response.results.length) setSearchError('No matching places. Try adding a region or country.')
    } catch (reason) {
      setSearchError(reason instanceof Error ? reason.message : 'City search is temporarily unavailable.')
    } finally { setSearching(false) }
  }
  function chooseCity(place: CityResult) {
    select(place.latitude, place.longitude, place.name)
    setCenter({ latitude: place.latitude, longitude: place.longitude })
    setZoom(12)
    setCityResults([])
  }
  return <div className="map-picker">
    <div className="map-picker-heading"><div><strong>Select the organization location</strong><small>Drag to pan, use + / − to zoom, then click to place a pin.</small></div><MapPin size={18} /></div>
    <div className="map-city-search" role="search">
      <label htmlFor="organization-city-search">Search city or place</label>
      <div><input id="organization-city-search" value={cityQuery} onChange={event => setCityQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void searchCity() } }} maxLength={100} placeholder="e.g. Kathmandu, Nepal" /><button type="button" className="secondary-button" disabled={searching || cityQuery.trim().length < 2} onClick={() => void searchCity()}>{searching ? 'Searching…' : 'Search'}</button></div>
    </div>
    {searchError && <p className="map-search-message" role="status">{searchError}</p>}
    {!!cityResults.length && <ul className="map-search-results" aria-label="City search results">{cityResults.map((place, index) => <li key={`${place.latitude}-${place.longitude}-${index}`}><button type="button" onClick={() => chooseCity(place)}><MapPin size={15} /><span>{place.name}</span></button></li>)}</ul>}
    <div ref={mapRef} className="map-canvas" aria-label="Map location selector" onClick={click} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
      {tiles.map(tile => <img key={`${zoom}/${tile.x}/${tile.y}`} draggable={false} alt="" className="map-tile" src={`https://tile.openstreetmap.org/${zoom}/${tile.wrappedX}/${tile.y}.png`} style={{ left: tile.left, top: tile.top }} />)}
      {marker && marker.left >= 0 && marker.left <= size.width && marker.top >= 0 && marker.top <= size.height && <span className="map-marker" style={{ left: marker.left, top: marker.top }}><MapPin size={32} fill="#c74f36" /></span>}
      <div className="map-zoom"><button type="button" aria-label="Zoom in" onClick={event => changeZoom(1, event)}>+</button><button type="button" aria-label="Zoom out" onClick={event => changeZoom(-1, event)}>−</button></div>
      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()}>© OpenStreetMap contributors</a>
    </div>
    <div className="coordinate-inputs"><label>Latitude<input aria-label="Latitude" type="number" min="-90" max="90" step="0.00001" value={latitude ?? ''} onChange={event => { const value = event.target.value; select(value === '' ? null : Number(value), longitude) }} /></label><label>Longitude<input aria-label="Longitude" type="number" min="-180" max="180" step="0.00001" value={longitude ?? ''} onChange={event => { const value = event.target.value; select(latitude, value === '' ? null : Number(value)) }} /></label></div>
  </div>
}

function mercatorY(latitude: number, size: number) {
  const radians = Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI / 180
  return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * size
}

function OwnerCredentialsPopover({ owner, done }: { owner: ProvisionedOwner; done: () => void }) {
  const runCritical = usePlatformStepUp()
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  async function emailCredentials() {
    setBusy(true); setError('')
    try {
      const verified = await runCritical(async () => {
        try {
          await platformRequest(`organizations/${owner.id}/owner-credentials-email`, 'POST', { password: owner.temporaryPassword })
          setSent(true)
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to queue the email.') }
        finally { setBusy(false) }
      })
      if (!verified) setBusy(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to verify your identity.'); setBusy(false) }
  }
  async function copyPassword() {
    try { await navigator.clipboard.writeText(owner.temporaryPassword) }
    catch { setError('Clipboard access failed. Select and copy the password above.') }
  }
  return <div className="step-up-backdrop credential-backdrop"><section className="step-up-popover credential-popover" role="dialog" aria-modal="true" aria-labelledby="credential-title">
    <span className="credential-icon"><Mail size={20} /></span>
    <h2 id="credential-title">Organization created</h2>
    <p>Send the administrator’s temporary sign-in details to their email address.</p>
    <div className="credential-recipient"><span>Administrator</span><strong>{owner.email}</strong></div>
    <div className="credential-password"><span>Temporary password</span><code>{owner.temporaryPassword}</code><small>The administrator must set a new password at first sign-in.</small></div>
    {sent ? <p className="credential-success" role="status"><Check size={16} />Email queued for {owner.email}.</p> : <p className="credential-privacy">The email is encrypted in the delivery queue and expires if it cannot be delivered within one hour.</p>}
    {error && <p role="alert">{error}</p>}
    <div className="step-up-actions"><button className="primary-button" disabled={busy || sent} onClick={() => void emailCredentials()}><Mail size={16} />{busy ? 'Sending…' : sent ? 'Email queued' : 'Email sign-in details'}</button><button type="button" className="secondary-button" onClick={() => void copyPassword()}><Copy size={15} />Copy password</button><button type="button" className="secondary-button" disabled={busy} onClick={done}>{sent ? 'Done' : 'Close'}</button></div>
  </section></div>
}

function LimitEditor({ row }: { row: PlatformOrganization }) {
  const cache = useQueryClient()
  const runCritical = usePlatformStepUp()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('')
    const form = new FormData(event.currentTarget)
    try { const verified = await runCritical(async () => { try {
      await platformRequest(`organizations/${row.id}/limits`, 'PUT', { store_limit: Number(form.get('store_limit')), employee_limit: Number(form.get('employee_limit')) })
      await Promise.all([
        cache.invalidateQueries({ queryKey: ['platform-organizations'] }),
        cache.invalidateQueries({ queryKey: ['platform-organization', row.id] }),
      ]); setEditing(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save limits.') } finally { setBusy(false) } }); if (!verified) setBusy(false) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to verify your identity.'); setBusy(false) }
  }
  if (!editing) return <button className="secondary-button" onClick={() => setEditing(true)}>Set limits</button>
  return <form className="limit-editor" onSubmit={save}><label>Stores<input name="store_limit" type="number" min="1" defaultValue={row.store_limit} required /></label><label>Employees<input name="employee_limit" type="number" min="1" defaultValue={row.employee_limit} required /></label>{error && <small role="alert">{error}</small>}<button className="primary-button" disabled={busy}>Save</button><button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancel</button></form>
}

export function OrganizationOverview({ openSection }: { openSection: (section: 'setup' | 'people') => void }) {
  return <OrganizationOnboarding openSection={openSection} />
}

export function StoreOverview({ openSetup }: { openSetup: () => void }) {
  return <><div className="compact-page-bar"><h1>Store overview</h1><span className="demo-label">DEMO DATA</span><button className="primary-button" onClick={openSetup}>Store settings</button></div><Metrics items={[{ label: 'Register status', value: '1 open', note: 'Main Counter' }, { label: 'Team on shift', value: '3', note: 'All checked in' }, { label: 'Today’s sales', value: 'Rs. 0', note: 'Checkout pending', pending: true }, { label: 'Stock alerts', value: '0', note: 'Inventory pending', pending: true }]} /><div className="dashboard-columns"><section className="panel"><div className="panel-heading"><h3>Store controls</h3><span className="state">Open for business</span></div><ul className="readiness-list"><li className="done">Store identity and receipt details</li><li className="done">Main Counter register active</li><li className="done">Store-scoped employee access</li><li className="todo">Catalog and opening stock</li></ul></section><section className="panel"><div className="panel-heading"><h3>Registers</h3><button onClick={openSetup}>Manage registers</button></div><p className="muted">Register sessions and sales are the next operational milestone.</p></section></div></>
}
