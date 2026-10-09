import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowRight, Check, CheckCircle2 } from 'lucide-react'
import { identity } from './session'
import type { Identity } from './session'
import { setupRequest } from './organization-api'
import type { Setup } from './StoreSetup'
import { OrganizationStepUpProvider, useOrganizationStepUp } from './PlatformStepUp'
import { SecurityPanel } from './identity'
import { useAccountActions } from './auth'
import './quick-setup.css'

function ready(data: Setup) {
  return data.organization.configured && data.stores.some(store => store.active && store.registers.some(register => register.active))
}

export default function AdminQuickSetup({ memberships, manual, autoEnabled, onActiveChange, done, children }: { memberships: Identity['memberships']; manual: boolean; autoEnabled: boolean; onActiveChange: (active: boolean) => void; done: () => void; children: ReactNode }) {
  const eligible = memberships.filter(member => member.all_stores && member.permissions.includes('organization.setup'))
  const queries = useQueries({ queries: eligible.map(member => ({ queryKey: ['store-setup', member.organization_id], queryFn: () => setupRequest(`${member.organization_id}/setup`) as Promise<Setup>, enabled: manual || autoEnabled, retry: false, refetchOnWindowFocus: false, staleTime: 30_000 })) })
  if (!eligible.length || (!manual && !autoEnabled)) return <>{children}</>
  if (queries.some(query => query.isPending)) return <p role="status">Checking organization setup…</p>
  const failed = queries.find(query => query.isError && !query.data)
  if (failed) return <section className="panel"><h2>Unable to check setup</h2><p role="alert">{failed.error?.message}</p><button className="secondary-button" onClick={() => { queries.forEach(query => { if (query.isError) void query.refetch() }) }}>Try again</button><button className="secondary-button" onClick={done}>Continue later</button></section>
  return <SetupSession key={manual ? 'manual' : 'automatic'} organizations={queries.map(query => query.data!)} manual={manual} onActiveChange={onActiveChange} done={done}>{children}</SetupSession>
}

function SetupSession({ organizations, manual, onActiveChange, done, children }: { organizations: Setup[]; manual: boolean; onActiveChange: (active: boolean) => void; done: () => void; children: ReactNode }) {
  const [organizationId, setOrganizationId] = useState(() => (organizations.find(data => !ready(data)) || (manual ? organizations[0] : undefined))?.organization.id)
  const data = organizations.find(data => data.organization.id === organizationId)
  if (!data) return <>{children}</>
  function close() { setOrganizationId(undefined); done() }
  return <OrganizationStepUpProvider key={data.organization.id}><Guide data={data} organizations={organizations} select={setOrganizationId} onActiveChange={onActiveChange} close={close} /></OrganizationStepUpProvider>
}

function Guide({ data, organizations, select, onActiveChange, close }: { data: Setup; organizations: Setup[]; select: (id: string) => void; onActiveChange: (active: boolean) => void; close: () => void }) {
  const account = useQuery({ queryKey: ['identity'], queryFn: identity, retry: false })
  const actions = useAccountActions()
  const cache = useQueryClient()
  const runCritical = useOrganizationStepUp()
  const heading = useRef<HTMLHeadingElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [chosenStore, setChosenStore] = useState('')
  const org = data.organization
  const securityReady = !!account.data?.email_verified && !!account.data?.mfa_enabled
  const activeStores = data.stores.filter(store => store.active)
  const store = activeStores.find(row => row.id === chosenStore) || activeStores[0]
  const complete = securityReady && ready(data)
  const step = !securityReady ? 0 : !org.configured ? 1 : !activeStores.length ? 2 : !complete ? 3 : 4
  const steps = [
    { label: 'Secure your account', description: 'Verify email and connect an authenticator.', complete: securityReady },
    { label: 'Confirm business details', description: 'Set your currency and local timezone.', complete: org.configured },
    { label: 'Add your first store', description: 'Name your location and receipt identity.', complete: activeStores.length > 0 },
    { label: 'Create a register', description: 'Add the checkout counter for your store.', complete: ready(data) },
  ]
  useEffect(() => { onActiveChange(true); return () => onActiveChange(false) }, [onActiveChange])
  useEffect(() => { heading.current?.focus({ preventScroll: true }); document.querySelector('.controller-main')?.scrollTo({ top: 0 }) }, [step, org.id])
  async function refresh() { await cache.invalidateQueries({ queryKey: ['identity'] }) }
  async function save(event: FormEvent<HTMLFormElement>, path: string, body: object) {
    event.preventDefault()
    setBusy(true); setError('')
    try {
      await runCritical(async () => {
        await setupRequest(`${org.id}/${path}`, path === 'settings' ? 'PUT' : 'POST', body)
        await cache.invalidateQueries({ queryKey: ['store-setup', org.id] })
        await cache.invalidateQueries({ queryKey: ['operations-context', org.id] })
        await cache.invalidateQueries({ queryKey: ['platform-organizations'] })
        await cache.invalidateQueries({ queryKey: ['platform-organization', org.id] })
        await refresh()
      })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save. Please try again.') }
    finally { setBusy(false) }
  }
  return <section className="quick-setup" aria-label="Administrator onboarding">
    <header className="quick-setup-heading"><div><p className="eyebrow">GET STARTED / {org.name}</p><h1 ref={heading} tabIndex={-1}>{step === 4 ? 'Your workspace is ready' : 'Let’s set up your workspace'}</h1><p>Follow these steps to get your business ready for its first sale.</p></div>{organizations.length > 1 && <label>Organization<select aria-label="Organization" disabled={busy} value={org.id} onChange={event => { setError(''); select(event.target.value) }}>{organizations.map(item => <option key={item.organization.id} value={item.organization.id}>{item.organization.name}</option>)}</select></label>}</header>
    <div className="quick-setup-layout"><aside className="quick-setup-progress" aria-label="Setup progress"><p>{steps.filter(item => item.complete).length} of 4 steps complete</p><ol>{steps.map((item, index) => <li key={item.label} className={item.complete ? 'is-complete' : step === index ? 'is-current' : ''} aria-current={step === index ? 'step' : undefined}><span className="quick-step-number" aria-hidden="true">{item.complete ? <Check size={16} /> : index + 1}</span><div><strong>{item.label}</strong><p>{item.description}</p><span className="sr-only">{item.complete ? 'Completed' : step === index ? 'Current step' : 'Pending'}</span></div></li>)}</ol><p className="quick-setup-saved">Your completed steps are saved. You can return to Quick setup anytime.</p></aside>
      <div className="quick-setup-main">
        <section className="panel quick-setup-panel">
          {step < 4 && <div className="quick-step-heading"><span className="eyebrow">STEP {step + 1} OF 4</span><h2>{steps[step].label}</h2><p>{step === 0 ? 'Email verification and an authenticator are required to save organization changes. Complete both here and save your backup codes to continue.' : step === 1 ? 'We’ve filled in the details already provided. Review them and save to clear Setup pending.' : step === 2 ? 'Create your first trading location. You can add more stores later.' : 'A register represents a checkout counter. Add one to start using the terminal.'}</p></div>}
          {error && <div className="setup-alert"><p role="alert">{error}</p><button className="secondary-button" disabled={busy} onClick={() => void cache.invalidateQueries({ queryKey: ['store-setup', org.id] })}>Reload saved progress</button></div>}
          {step === 0 && account.data && actions && <><SecurityPanel onboarding account={account.data} email={account.data.email} verified={account.data.email_verified} mfa={account.data.mfa_enabled} emailEnabled={actions.emailEnabled} mfaAvailable={actions.securityAvailable} refresh={refresh} codes={actions.securityCodes} signedOut={actions.signedOut} changePassword={actions.password} /><button className="secondary-button" onClick={() => void refresh()}>Check security status</button></>}
          {step === 1 && <form key={`business-${org.id}-${org.version}`} onSubmit={event => {
            const values = Object.fromEntries(new FormData(event.currentTarget))
            void save(event, 'settings', { ...values, receipt_footer: org.receipt_footer, expected_version: org.version })
          }}><fieldset disabled={busy} className="quick-setup-fields"><legend className="sr-only">Business details</legend>
            <label className="quick-field-wide">Business name<input name="name" defaultValue={org.name} required maxLength={160} /></label>
            <label>Business type<select name="organization_type" defaultValue={org.organization_type}><option value="retail">Retail</option><option value="wholesale">Wholesale</option><option value="other">Other</option></select></label>
            <label>Currency<select name="currency" defaultValue={org.currency}>{data.currencies.map(currency => <option key={currency}>{currency}</option>)}</select></label>
            <label className="quick-field-wide">Timezone<select name="timezone" defaultValue={org.timezone}>{data.timezones.map(timezone => <option key={timezone}>{timezone}</option>)}</select></label>
            <label className="quick-field-wide">Business address <small>Optional</small><input name="location_label" defaultValue={org.location_label} maxLength={240} /></label>
            <label>Contact email <small>Optional</small><input name="contact_email" type="email" defaultValue={org.contact_email} maxLength={254} /></label>
            <label>Phone <small>Optional</small><input name="phone" type="tel" defaultValue={org.phone} maxLength={40} /></label>
            <button className="primary-button icon-button quick-field-wide">{busy ? 'Saving…' : 'Save business details & continue'}<ArrowRight size={16} aria-hidden="true" /></button>
          </fieldset></form>}
          {step === 2 && (data.stores.length >= org.store_limit ? <p role="alert">Your store allowance is full. Activate an existing store in Stores &amp; registers, or request more stores in Organization settings.</p> : <form key={`store-${org.id}`} onSubmit={event => {
            const values = Object.fromEntries(new FormData(event.currentTarget))
            void save(event, 'stores', { ...values, timezone: org.timezone, phone: org.phone, contact_email: org.contact_email, receipt_footer: org.receipt_footer, receipt_name: values.name })
          }}><fieldset disabled={busy} className="quick-setup-fields"><legend className="sr-only">First store</legend>
            <label className="quick-field-wide">Store name<input name="name" defaultValue={`${org.name} — Main store`.slice(0, 160)} required maxLength={160} /></label>
            <label className="quick-field-wide">Store address <small>Optional</small><textarea name="address" defaultValue={org.location_label} maxLength={500} /></label>
            <p className="quick-field-wide quick-form-note">Your business contact details, timezone and receipt footer will be used. A store code is generated automatically.</p>
            <button className="primary-button icon-button quick-field-wide">{busy ? 'Creating…' : 'Create store & continue'}<ArrowRight size={16} aria-hidden="true" /></button>
          </fieldset></form>)}
          {step === 3 && store && <form key={`register-${org.id}-${store.id}`} onSubmit={event => { void save(event, `stores/${store.id}/registers`, Object.fromEntries(new FormData(event.currentTarget))) }}><fieldset disabled={busy} className="quick-setup-fields"><legend className="sr-only">First register</legend>
            {activeStores.length > 1 ? <label className="quick-field-wide">Store<select aria-label="Store" value={store.id} onChange={event => { setChosenStore(event.target.value); setError('') }}>{activeStores.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <p className="quick-field-wide quick-form-note">Creating a register for <strong>{store.name}</strong>.</p>}
            <label>Register name<input name="name" defaultValue="Main counter" required maxLength={160} /></label>
            <label>Register code<input name="code" defaultValue={store.registers.some(register => register.code === 'COUNTER-1') ? '' : 'COUNTER-1'} required maxLength={20} pattern="[A-Za-z0-9][A-Za-z0-9_-]{0,19}" /><small>A permanent code, unique within this store.</small></label>
            <button className="primary-button icon-button quick-field-wide">{busy ? 'Creating…' : 'Create register & finish'}<ArrowRight size={16} aria-hidden="true" /></button>
          </fieldset></form>}
          {step === 4 && <div className="quick-setup-complete"><CheckCircle2 size={40} aria-hidden="true" /><h2>All set, {org.name}</h2><p>Your business details are saved and an active store and register are ready. You can now add products, invite your team and start selling.</p><button className="primary-button icon-button" onClick={close}>Open workspace<ArrowRight size={16} aria-hidden="true" /></button>{organizations.some(item => item.organization.id !== org.id && !ready(item)) && <button className="secondary-button" onClick={() => select(organizations.find(item => item.organization.id !== org.id && !ready(item))!.organization.id)}>Set up another organization</button>}</div>}
        </section>
        {step < 4 && <button className="quick-setup-later" disabled={busy} onClick={close}>Continue later</button>}
      </div>
    </div>
  </section>
}
