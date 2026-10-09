import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { identity } from './session'
import { OrganizationStepUpProvider, useOrganizationStepUp } from './PlatformStepUp'
import './stores.css'
import { setupRequest } from './organization-api'
import StoreDirectory from './StoreDirectory'

type Business = {
  id: string; name: string; phone: string; contact_email: string; currency: string;
  timezone: string; receipt_footer: string; configured: boolean; version: number;
  organization_type: string; image_url: string; website_url: string; location_label: string;
  store_limit: number; employee_limit: number
}
export type Register = { id: string; code: string; name: string; active: boolean; version: number }
export type Store = {
  id: string; code: string; name: string; address: string; phone: string; contact_email: string;
  timezone: string; opening_hours: string; receipt_name: string; receipt_footer: string;
  active: boolean; version: number; registers: Register[]
}
export type Setup = { organization: Business; stores: Store[]; currencies: string[]; timezones: string[] }
type Editor = { kind: 'business' | 'store' | 'register'; store?: Store; register?: Register }


export default function StoreSetup({ mode = 'stores', openSettings }: { mode?: 'stores' | 'settings'; openSettings?: () => void }) {
  const account = useQuery({ queryKey: ['identity'], queryFn: identity, retry: false })
  const [organizationId, setOrganizationId] = useState('')
  const memberships = account.data?.memberships.filter(m => m.all_stores && m.permissions.includes('organization.setup')) || []
  const selected = memberships.find(m => m.organization_id === organizationId) || memberships[0]
  if (!account.data) return null
  if (!selected) return <section className="panel"><h2>{mode === 'settings' ? 'Organization settings' : 'Stores'}</h2><p className="muted">Your account does not have permission to manage this organization. Contact the organization owner.</p></section>
  return <section id="setup" className="store-setup" aria-label={mode === 'settings' ? 'Organization settings' : 'Store and register setup'}>
    <div className="setup-heading"><h2>{mode === 'settings' ? selected.name : 'Stores & registers'}</h2>
      {memberships.length > 1 && <label>Organization<select aria-label="Organization" value={selected.organization_id} onChange={e => setOrganizationId(e.target.value)}>
        {memberships.map(m => <option key={m.organization_id} value={m.organization_id}>{m.name}</option>)}
      </select></label>}
    </div>
    <OrganizationStepUpProvider key={`${selected.organization_id}-${mode}`}><Workspace organizationId={selected.organization_id} mode={mode} openSettings={openSettings} /></OrganizationStepUpProvider>
  </section>
}

function Workspace({ organizationId, mode, openSettings }: { organizationId: string; mode: 'stores' | 'settings'; openSettings?: () => void }) {
  const cache = useQueryClient()
  const runCritical = useOrganizationStepUp()
  const query = useQuery<Setup>({ queryKey: ['store-setup', organizationId],
    queryFn: () => setupRequest(`${organizationId}/setup`), retry: false, refetchOnWindowFocus: false })
  const [storeId, setStoreId] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [requestingStores, setRequestingStores] = useState(false)
  const [requestMessage, setRequestMessage] = useState('')
  const [message, setMessage] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    if (editor) document.querySelector<HTMLInputElement>('.setup-editor input')?.focus()
  }, [editor])
  async function reload() {
    await query.refetch()
    await cache.invalidateQueries({ queryKey: ['identity'] })
  }
  async function save(path: string, method: string, body: object) {
    setBusy(true); setError(''); setMessage('')
    try {
      await runCritical(async () => {
        try {
          const result = await setupRequest(`${organizationId}/${path}`, method, body)
          setEditor(null)
          if (path === 'stores') setStoreId((result as Store).id)
          await reload(); setMessage(path === 'stores' ? 'Store added.' : 'Changes saved.')
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not confirm the save. Reload before retrying.') }
      })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not confirm the save. Reload before retrying.') }
    finally { setBusy(false) }
  }
  async function status(store: Store, register?: Register) {
    const row = register || store
    if (row.active && !window.confirm(register
      ? `Deactivate ${register.name}? Its history will be preserved.`
      : `Deactivate ${store.name} and all of its registers? Reactivating the store will leave its registers inactive until you activate them individually.`)) return
    await save(`stores/${store.id}${register ? `/registers/${register.id}` : ''}/status`, 'POST',
      { active: !row.active, expected_version: row.version })
  }
  async function requestMoreStores(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setBusy(true); setError(''); setRequestMessage('')
    try {
      await setupRequest(`${organizationId}/store-limit-requests`, 'POST', {
        requested_limit: Number(values.get('requested_limit')),
        reason: String(values.get('reason') || '').trim(),
      })
      setRequestingStores(false)
      setRequestMessage('Request sent to the platform team for review.')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to send the request.') }
    finally { setBusy(false) }
  }
  if (query.isPending) return <p role="status">Loading stores…</p>
  if (!query.data) return <section className="panel"><p role="alert">{query.error?.message || 'Unable to load setup.'}</p><button className="secondary-button" onClick={() => void reload()}>Retry loading setup</button></section>
  const data = query.data
  return <>
    {query.isError && <div className="setup-alert"><p role="alert">{query.error.message}</p><button className="secondary-button" disabled={busy} onClick={() => void reload()}>Retry loading setup</button></div>}
    {error && !(editor?.kind === 'store' && !editor.store) && <div role="alert" className="setup-alert"><p>{error}</p><button className="secondary-button" disabled={busy} onClick={() => { setEditor(null); setError(''); void reload() }}>Reload latest details</button></div>}
    {message && <p role="status" className="setup-message">{message}</p>}
    {mode === 'settings' ? <><section className="panel business-summary" aria-label="Business settings">
      <div><p className="eyebrow">{data.organization.configured ? 'BUSINESS DETAILS' : 'STEP 1 · BUSINESS DETAILS'}</p>
        <div className="settings-profile-heading">{data.organization.image_url ? <img src={data.organization.image_url} alt="" /> : <span>{data.organization.name.charAt(0).toUpperCase()}</span>}<div><h3>{data.organization.name}</h3><p className="muted">{data.organization.organization_type} · {data.organization.location_label || 'Location not set'}</p></div></div><p className="muted">{data.organization.currency} · {data.organization.timezone}</p>{data.organization.website_url && <a href={data.organization.website_url} target="_blank" rel="noreferrer">{data.organization.website_url}</a>}
        {!data.organization.configured && <p className="muted">Confirm your business details before adding a store.</p>}
      </div>
      <button className="secondary-button" disabled={busy} onClick={() => setEditor({ kind: 'business' })}>{data.organization.configured ? 'Edit organization' : 'Configure organization'}</button>
    </section>{editor && <SetupForm key="business" editor={editor} data={data} disabled={busy} save={save} close={() => setEditor(null)} />}<section className="panel capacity-panel"><div><p className="eyebrow">CAPACITY</p><h3>Store allowance</h3><p className="muted">{data.stores.length} of {data.organization.store_limit} stores used. Store limits are reviewed by your platform administrator.</p><div className="progress-track"><span style={{ width: `${Math.min(100, data.stores.length / Math.max(data.organization.store_limit, 1) * 100)}%` }} /></div><p className="muted">Employee allowance: {data.organization.employee_limit}</p></div><button className="secondary-button" onClick={() => setRequestingStores(value => !value)} aria-expanded={requestingStores}>Request more stores</button>{requestingStores && <form className="store-limit-request" onSubmit={requestMoreStores}><label>Requested total stores<input name="requested_limit" type="number" min={data.organization.store_limit + 1} max="10000" defaultValue={data.organization.store_limit + 1} required /></label><label>Why do you need more stores?<textarea name="reason" minLength={10} maxLength={1000} required placeholder="Tell the platform team about your planned locations." /></label><div className="action-row"><button className="primary-button" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button><button type="button" className="secondary-button" onClick={() => setRequestingStores(false)}>Cancel</button></div></form>}{requestMessage && <p role="status" className="setup-message">{requestMessage}</p>}</section></> : !data.organization.configured && <section className="panel settings-prompt"><div><h3>Finish organization settings first</h3><p className="muted">Confirm your business details before adding a store.</p></div><button className="secondary-button" onClick={openSettings}>Open settings</button></section>}
    {mode === 'stores' && <>
    {editor && (editor.kind === 'store' && !editor.store ? <div className="store-editor-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setEditor(null) }}><div className="store-editor-dialog" role="dialog" aria-modal="true" aria-label="Add a store"><SetupForm key="new-store" editor={editor} data={data} disabled={busy} error={error} save={save} close={() => setEditor(null)} /></div></div> : <SetupForm key={`${editor.kind}-${editor.store?.id || 'new'}-${editor.register?.id || ''}`} editor={editor} data={data} disabled={busy} save={save} close={() => setEditor(null)} />)}
    <StoreDirectory data={data} selectedId={storeId} select={id => { setStoreId(id); setEditor(null); setError(''); setMessage('') }} busy={busy} refreshing={query.isFetching} refresh={() => void reload()} openSettings={openSettings} addStore={() => setEditor({ kind: 'store' })} editStore={store => { setStoreId(store.id); setEditor({ kind: 'store', store }) }} addRegister={store => setEditor({ kind: 'register', store })} editRegister={(store, register) => setEditor({ kind: 'register', store, register })} status={status} />
    </>}

  </>
}

function SetupForm({ editor, data, disabled, error, save, close }: {
  editor: Editor; data: Setup; disabled: boolean; error?: string;
  save: (path: string, method: string, body: object) => Promise<void>; close: () => void
}) {
  // Capture the version displayed when editing began; refetches must not silently overwrite edits.
  const [business] = useState(data.organization)
  const [useOwnStoreCode, setUseOwnStoreCode] = useState(false)
  const current = editor.kind === 'business' ? business : editor.kind === 'store' ? editor.store : editor.register
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values: Record<string, string | number> = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>
    if (current) values.expected_version = current.version
    if (editor.kind === 'store' && !values.receipt_name) values.receipt_name = values.name
    const path = editor.kind === 'business' ? 'settings' : editor.kind === 'store'
      ? `stores${editor.store ? '/' + editor.store.id : ''}`
      : `stores/${editor.store!.id}/registers${editor.register ? '/' + editor.register.id : ''}`
    await save(path, current ? 'PUT' : 'POST', values)
  }
  const title = editor.kind === 'business' ? 'Business details' : editor.kind === 'store'
    ? editor.store ? 'Edit store details' : 'Add a store' : editor.register ? 'Rename register' : 'Add a register'
  const contact = editor.kind === 'store' ? editor.store : business
  return <section className="panel setup-editor" aria-label={title}>
    <h3>{title}</h3>
    <form onSubmit={submit}>
      <fieldset disabled={disabled}><legend className="sr-only">{title}</legend><div className="setup-fields">
        {editor.kind === 'store' && !editor.store && <div className="wide-field store-code-choice"><p className="muted">A permanent store code will be generated when you create the store.</p><label><input type="checkbox" checked={useOwnStoreCode} onChange={event => setUseOwnStoreCode(event.target.checked)} />I already have a store code</label></div>}
        {!current && (editor.kind === 'register' || useOwnStoreCode) && <label>{editor.kind === 'store' ? 'Store code' : 'Register code'}<input name="code" maxLength={20} pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,19}" required autoFocus={editor.kind === 'store'} placeholder={editor.kind === 'store' ? 'MAIN' : 'COUNTER-1'} /><small>A permanent code, unique within its {editor.kind === 'store' ? 'organization' : 'store'}.</small></label>}
        <label>{editor.kind === 'business' ? 'Business name' : editor.kind === 'store' ? 'Store name' : 'Register name'}<input name="name" defaultValue={current?.name || ''} required maxLength={160} /></label>
        {editor.kind !== 'register' && <>
          {editor.kind === 'business' && <>
            <label>Organization type<select name="organization_type" defaultValue={business.organization_type}><option value="retail">Retail</option><option value="wholesale">Wholesale</option><option value="other">Other</option></select></label>
            <label>Image URL<input name="image_url" type="url" defaultValue={business.image_url} maxLength={1000} placeholder="https://example.com/logo.png" /></label>
            <label>Website<input name="website_url" type="url" defaultValue={business.website_url} maxLength={300} placeholder="https://example.com" /></label>
            <label className="wide-field">Location / address<input name="location_label" defaultValue={business.location_label} maxLength={240} /></label>
          </>}
          <label>Contact email<input name="contact_email" type="email" defaultValue={contact?.contact_email || ''} maxLength={254} /></label>
          <label>Phone<input name="phone" type="tel" defaultValue={contact?.phone || ''} maxLength={40} /></label>
          {editor.kind === 'business' && <label>Currency<select name="currency" defaultValue={business.currency}>{data.currencies.map(c => <option key={c}>{c}</option>)}</select></label>}
          <label>Timezone<select name="timezone" defaultValue={contact?.timezone || business.timezone}>{data.timezones.map(t => <option key={t}>{t}</option>)}</select></label>
          {editor.kind === 'store' && <>
            <label className="wide-field">Address<textarea name="address" defaultValue={editor.store?.address || ''} maxLength={500} /></label>
            <label className="wide-field">Opening hours<input name="opening_hours" defaultValue={editor.store?.opening_hours || ''} maxLength={500} placeholder="Sun–Fri, 9 am–7 pm" /><small>Display information; this does not automatically open or close a store.</small></label>
            <label>Receipt name<input name="receipt_name" defaultValue={editor.store?.receipt_name || ''} maxLength={160} placeholder="Defaults to store name" /></label>
          </>}
          <label className="wide-field">Receipt footer<textarea name="receipt_footer" defaultValue={contact?.receipt_footer ?? business.receipt_footer} maxLength={500} /></label>
        </>}
      </div>
      {editor.kind === 'business' && <p className="muted">Timezone and receipt footer become defaults for new stores. Existing stores keep their own settings.</p>}
      {editor.kind === 'store' && !editor.store && <p className="muted">Store code is permanent. You can edit the other details later.</p>}
      {error && <p role="alert" className="setup-form-error">{error}</p>}
      <button className="primary-link">{editor.kind === 'business' ? 'Save business settings' : editor.kind === 'store' ? editor.store ? 'Save store' : 'Create store' : 'Save register'}</button>
      </fieldset>
      <button type="button" className="secondary-button" disabled={disabled} onClick={close}>Cancel</button>
    </form>
  </section>
}
