import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { ArrowRight, ArrowUpRight, Check, Copy, Mail, MapPin, Trash2, X } from 'lucide-react'
import { platformRequest } from './platform-api'
import { OrganizationOnboarding } from './OrganizationOnboarding'
import { usePlatformStepUp } from './PlatformStepUp'
import './onboarding.css'
import './organization-created.css'

type Metric = { label: string; value: string; note: string; pending?: boolean }
export type PlatformOrganization = { id: string; slug: string; login_url: string; name: string; organization_type: string; image_url: string; location_label: string; configured: boolean; store_limit: number; employee_limit: number; active_employees: number; deletion_scheduled_for: string | null; billing_plan: string | null; billing_amount_minor: number | null; billing_currency: string | null; billing_interval: 'monthly' | 'yearly' | null }
export type OrganizationDetail = PlatformOrganization & { contact_email: string; phone: string; owner_name: string; owner_phone: string; owner_title: string; website_url: string; latitude: number | null; longitude: number | null; currency: string; timezone: string; stores: number; version: number; billing_tier: string | null; store_limit_requests: { id: string; created: string; current_limit: number; requested_limit: number; reason: string }[] }
export type ProvisionedOwner = { id: string; login_url: string; organization: string; email: string; temporaryPassword: string }

function Metrics({ items }: { items: Metric[] }) {
  return <div className="dashboard-grid">{items.map(item => <article className="metric-card" key={item.label}><p>{item.label}</p><strong>{item.value}</strong><small className={item.pending ? 'pending' : ''}>{item.note}</small></article>)}</div>
}

export function PlatformOverview({ openOrganizations }: { openOrganizations: () => void }) {
  const organizations = useQuery<PlatformOrganization[]>({ queryKey: ['platform-organizations'], queryFn: () => platformRequest('organizations'), retry: false })
  if (organizations.isPending) return <p role="status">Loading platform overview…</p>
  if (organizations.isError) return <section className="panel"><p role="alert">{organizations.error.message}</p><button className="secondary-button" onClick={() => void organizations.refetch()}>Try again</button></section>
  const rows = organizations.data
  return <div className="platform-organizations"><div className="platform-page-heading"><div><span className="platform-kicker">PLATFORM</span><h1>Overview</h1><p>Your organizations, setup, and commercial capacity.</p></div><button className="primary-button icon-button" onClick={openOrganizations}>View organizations <ArrowRight size={16} /></button></div><Metrics items={[
    { label: 'Organizations', value: String(rows.length), note: 'Across the platform' },
    { label: 'Configured', value: String(rows.filter(row => row.configured && !row.deletion_scheduled_for).length), note: 'Organization settings saved' },
    { label: 'Setup pending', value: String(rows.filter(row => !row.configured && !row.deletion_scheduled_for).length), note: 'Ready for follow-up' },
    { label: 'Pending deletion', value: String(rows.filter(row => row.deletion_scheduled_for).length), note: 'Scheduled for removal' },
  ]} /><section className="platform-section"><div className="platform-section-heading"><div><h2>Needs attention</h2><p>Setup pending or approaching employee allowance.</p></div></div>{rows.filter(row => !row.configured || row.active_employees >= row.employee_limit * .8 || row.deletion_scheduled_for).length ? <ul className="location-list">{rows.filter(row => !row.configured || row.active_employees >= row.employee_limit * .8 || row.deletion_scheduled_for).map(row => <li key={row.id}><div><strong>{row.name}</strong><small>{row.deletion_scheduled_for ? 'Deletion scheduled' : !row.configured ? 'Setup pending' : `${row.active_employees} / ${row.employee_limit} employee seats`}</small></div></li>)}</ul> : <p className="muted">No organizations need attention.</p>}<button className="secondary-button" onClick={openOrganizations}>Manage organizations</button></section></div>
}

export function DeleteOrganization({ row, deleted }: { row: OrganizationDetail; deleted: () => void }) {
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

type CityResult = { name: string; latitude: number; longitude: number }

export function LocationMapPicker({ latitude, longitude, select }: { latitude: number | null; longitude: number | null; select: (latitude: number | null, longitude: number | null, placeName?: string) => void }) {
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

export function OwnerCredentialsPopover({ owner, done }: { owner: ProvisionedOwner; done: () => void }) {
  const runCritical = usePlatformStepUp()
  const dialog = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLElement>('#credential-title')?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])
  function keys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && !busy) { event.preventDefault(); done() }
    if (event.key !== 'Tab') return
    const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') || [])
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement?.id === 'credential-title')) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
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
    try { await navigator.clipboard.writeText(owner.temporaryPassword); setCopied(true); setError('') }
    catch { setError('Clipboard access failed. Select and copy the password above.') }
  }
  return <div className="step-up-backdrop credential-backdrop"><section ref={dialog} className="step-up-popover credential-popover" role="dialog" aria-modal="true" aria-labelledby="credential-title" aria-describedby="credential-description" onKeyDown={keys}>
    <header className="credential-heading"><span className="credential-icon"><Check size={22} aria-hidden="true" /></span><div><span className="credential-eyebrow">Workspace ready</span><h2 id="credential-title" tabIndex={-1}>Organization created</h2></div><button className="credential-close" type="button" aria-label="Close confirmation" disabled={busy} onClick={done}><X size={18} aria-hidden="true" /></button></header>
    <p id="credential-description"><strong>{owner.organization}</strong> is ready. Share the sign-in details with its administrator.</p>
    <dl className="credential-account"><div><dt>Workspace sign-in</dt><dd><a href={owner.login_url} target="_blank" rel="noreferrer">{owner.login_url}<ArrowUpRight size={14} aria-hidden="true" /></a></dd></div><div><dt>Administrator email</dt><dd>{owner.email}</dd></div></dl>
    <div className="credential-password"><div className="credential-password-heading"><span>Temporary password</span><button type="button" className="credential-copy" onClick={() => void copyPassword()}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? 'Copied' : 'Copy password'}</button></div><code>{owner.temporaryPassword}</code><small>The administrator must choose a new password at first sign-in.</small><span className="sr-only" role="status">{copied ? 'Password copied to clipboard.' : ''}</span></div>
    {sent ? <div className="credential-delivery is-sent" role="status"><Check size={17} aria-hidden="true" /><div><strong>Email queued</strong><span>The administrator’s sign-in details are queued for delivery.</span></div></div> : <div className="credential-delivery"><Mail size={17} aria-hidden="true" /><div><strong>Send the sign-in details</strong><span>Email the workspace link and temporary password to the administrator.</span></div></div>}
    {error && <p role="alert" className="credential-error">{error}</p>}
    <footer className="credential-actions"><button type="button" className="secondary-button" disabled={busy} onClick={done}>{sent ? 'Done' : 'Close'}</button><button className="primary-button" disabled={busy || sent} onClick={() => void emailCredentials()}><Mail size={15} aria-hidden="true" />{busy ? 'Sending…' : sent ? 'Email queued' : 'Email sign-in details'}</button></footer>
  </section></div>
}

export function LimitEditor({ row }: { row: PlatformOrganization }) {
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
