import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, ArrowUpRight, Building2, CheckCircle2, Circle, CreditCard, Info, Plus, RefreshCw, Search, Store, Users, X } from 'lucide-react'
import { platformRequest } from './platform-api'
import { usePlatformStepUp } from './PlatformStepUp'
import { DeleteOrganization, LimitEditor, OwnerCredentialsPopover } from './ControlPanels'
import InviteOrganization from './InviteOrganization'
import OrganizationSubdomain from './OrganizationSubdomain'
import { navigate, usePathname } from './navigation'
import type { OrganizationDetail, PlatformOrganization, ProvisionedOwner } from './ControlPanels'
import './platform-organizations.css'

type Payment = { id: string; amount_minor: number; currency: string; paid_on: string; method: string; reference: string; created: string; voided_at: string | null; void_reason: string | null }
type Billing = { payments: Payment[]; recorded_totals: { currency: string; amount_minor: number }[] }
const currencies = ['NPR', 'INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'CNY', 'SGD', 'AED']
function money(minor: number, currency: string) { return new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'code' }).format(minor / (currency === 'JPY' ? 1 : 100)) }
function minorAmount(value: string, currency: string) {
  const decimals = currency === 'JPY' ? 0 : 2
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${decimals || 1}})?$`).test(value) || (decimals === 0 && value.includes('.'))) throw new Error(`Enter a valid ${currency} amount${decimals ? ' with up to two decimal places' : ' in whole yen'}.`)
  const [whole, fraction = ''] = value.split('.')
  const result = Number(whole) * (decimals ? 100 : 1) + (decimals ? Number(fraction.padEnd(2, '0')) : 0)
  if (!Number.isSafeInteger(result) || result > 2_000_000_000) throw new Error('Amount is too large.')
  return result
}
function rate(row: PlatformOrganization) { return row.billing_amount_minor !== null && row.billing_currency ? money(row.billing_amount_minor, row.billing_currency) : 'Not configured' }
function status(row: PlatformOrganization) { return row.deletion_scheduled_for ? 'Deletion scheduled' : row.configured ? 'Configured' : 'Setup pending' }
function OrganizationMark({ row }: { row: PlatformOrganization }) {
  const [failed, setFailed] = useState(false)
  return <span className="platform-org-mark">{row.image_url && !failed ? <img src={row.image_url} alt="" onError={() => setFailed(true)} /> : <Building2 size={20} aria-hidden="true" />}</span>
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="platform-field"><dt>{label}</dt><dd>{children || <span className="platform-unset">Not provided</span>}</dd></div> }

function SetupStatus({ org }: { org: PlatformOrganization }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  if (org.deletion_scheduled_for) return <span className="platform-status is-pending">{status(org)}</span>
  return <>
    <button type="button" className={`platform-status platform-setup-trigger ${org.configured ? '' : 'is-pending'}`} aria-label={`${status(org)}: view setup checklist for ${org.name}`} aria-haspopup="dialog" onClick={event => { event.stopPropagation(); dialog.current?.showModal() }}>{status(org)}<Info size={13} aria-hidden="true" /></button>
    <dialog ref={dialog} className="platform-setup-dialog" aria-labelledby={titleId} onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) dialog.current?.close() }} onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
      <div className="platform-setup-content">
        <div className="platform-section-heading"><div><span className="platform-kicker">{org.name}</span><h2 id={titleId}>Organization setup</h2></div><button type="button" className="secondary-button platform-setup-close" aria-label="Close setup checklist" onClick={() => dialog.current?.close()}><X size={18} aria-hidden="true" /></button></div>
        <p className="platform-setup-summary">{org.configured ? 'All required setup steps are complete.' : '1 required step is pending.'}</p>
        <ul className="platform-setup-checklist"><li className={org.configured ? 'is-complete' : ''}>{org.configured ? <CheckCircle2 size={20} aria-hidden="true" /> : <Circle size={20} aria-hidden="true" />}<div><strong>Confirm business settings</strong><span className="platform-setup-state">{org.configured ? 'Completed' : 'Pending'}</span><p>{org.configured ? 'The organization administrator has saved the business settings.' : 'An organization administrator needs to open Organization settings, select Configure organization, review the business details, currency and timezone, then select Save business settings.'}</p></div></li></ul>
        <p className="platform-setup-note">This status tracks whether business settings have been saved. Billing, payments, employee seats, stores and registers are managed separately.</p>
        <div className="platform-form-actions">{!org.configured && <a className="primary-button icon-button" href={org.login_url} target="_blank" rel="noreferrer">Open workspace sign-in<ArrowUpRight size={15} aria-hidden="true" /></a>}<button type="button" className="secondary-button" onClick={() => dialog.current?.close()}>Close</button></div>
      </div>
    </dialog>
  </>
}

export default function PlatformOrganizations({ superAdmin }: { superAdmin: boolean }) {
  const organizations = useQuery<PlatformOrganization[]>({ queryKey: ['platform-organizations'], queryFn: () => platformRequest('organizations'), retry: false })
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('name')
  const path = usePathname()
  const inviting = path === '/organizations/new'
  const selected = path.startsWith('/organizations/') && !inviting ? path.slice('/organizations/'.length) : null
  const setInviting = (value: boolean) => navigate(value ? '/organizations/new' : '/organizations')
  const [owner, setOwner] = useState<ProvisionedOwner | null>(null)
  const rows = organizations.data || []
  const visible = rows.filter(row => `${row.name} ${row.slug} ${row.location_label} ${row.organization_type}`.toLowerCase().includes(search.toLowerCase().trim()) && (filter === 'all' || filter === 'configured' && row.configured && !row.deletion_scheduled_for || filter === 'pending' && !row.configured && !row.deletion_scheduled_for || filter === 'deletion' && row.deletion_scheduled_for)).sort((a, b) => sort === 'seats' ? b.active_employees - a.active_employees || a.name.localeCompare(b.name) : a.name.localeCompare(b.name))
  const open = (id: string) => { navigate(`/organizations/${encodeURIComponent(id)}`); document.querySelector('.controller-main')?.scrollTo({ top: 0 }) }
  const back = () => { const id = selected; navigate('/organizations'); requestAnimationFrame(() => document.getElementById(`organization-${id}`)?.focus()) }
  if (inviting && superAdmin) return <InviteOrganization close={() => setInviting(false)} created={credentials => { setOwner(credentials); setInviting(false) }} />
  if (selected) return <OrganizationPage id={selected} superAdmin={superAdmin} back={back} />
  return <div className="platform-organizations">
    <div className="platform-page-heading"><div><span className="platform-kicker">PLATFORM / DIRECTORY</span><h1>Organizations</h1><p>Business profiles, billing, and capacity in one place.</p></div><div className="platform-heading-actions"><button className="secondary-button icon-button" disabled={organizations.isFetching} onClick={() => void organizations.refetch()}><RefreshCw size={16} aria-hidden="true" />Refresh</button>{superAdmin && <button className="primary-button icon-button" onClick={() => { setOwner(null); setInviting(true); document.querySelector('.controller-main')?.scrollTo({ top: 0 }) }}><Plus size={16} aria-hidden="true" />Add organization</button>}</div></div>
    <div className="platform-directory-summary"><span><strong>{organizations.isPending || organizations.isError ? '—' : rows.length}</strong> organizations</span><span><strong>{organizations.isPending || organizations.isError ? '—' : rows.filter(row => row.configured && !row.deletion_scheduled_for).length}</strong> configured</span><span><strong>{organizations.isPending || organizations.isError ? '—' : rows.filter(row => !row.configured && !row.deletion_scheduled_for).length}</strong> setup pending</span></div>
    <section className="platform-directory" aria-label="Organization directory">
      <div className="platform-table-toolbar"><label className="platform-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search organizations</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, workspace, or location" /></label><label><span className="sr-only">Organization status</span><select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All statuses</option><option value="configured">Configured</option><option value="pending">Setup pending</option><option value="deletion">Deletion scheduled</option></select></label><label><span className="sr-only">Sort organizations</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="name">Name A–Z</option><option value="seats">Most employee seats</option></select></label></div>
      {organizations.isPending ? <div className="platform-empty" role="status">Loading organizations…</div> : organizations.isError ? <div className="platform-empty"><p role="alert">{organizations.error.message}</p><button className="secondary-button" onClick={() => void organizations.refetch()}>Try again</button></div> : visible.length ? <div className="platform-table-scroll" tabIndex={0} role="region" aria-label="Organizations table"><table className="platform-table"><caption className="sr-only">Organizations with setup status, subscription rate, and employee capacity. Select an organization to view details.</caption><thead><tr><th scope="col">Organization</th><th scope="col">Status</th><th scope="col">Subscription</th><th scope="col">Employees</th><th scope="col">Location</th><th scope="col"><span className="sr-only">View details</span></th></tr></thead><tbody>{visible.map(row => <tr key={row.id} onClick={() => open(row.id)}><th scope="row"><button id={`organization-${row.id}`} className="platform-org-button" onClick={event => { event.stopPropagation(); open(row.id) }} aria-label={`View ${row.name}`}><OrganizationMark row={row} /><span><strong>{row.name}</strong><small>{row.subdomain_enabled ? new URL(row.login_url).hostname : 'Platform sign-in'} · {row.organization_type}</small></span></button></th><td><SetupStatus org={row} /></td><td><strong className={row.billing_amount_minor === null ? 'platform-unset' : 'platform-rate'}>{rate(row)}</strong>{row.billing_interval && <small>{row.billing_plan} · {row.billing_interval === 'monthly' ? 'per month' : 'per year'}</small>}</td><td><span className="platform-capacity-number">{row.active_employees}<span> / {row.employee_limit}</span></span><div className="platform-mini-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, row.active_employees / row.employee_limit * 100)}%` }} /></div></td><td>{row.location_label || <span className="platform-unset">Not provided</span>}</td><td><ArrowRight size={17} aria-hidden="true" /></td></tr>)}</tbody></table></div> : <div className="platform-empty"><Building2 size={28} aria-hidden="true" /><h2>{rows.length ? 'No matching organizations' : 'Your organization directory starts here'}</h2><p>{rows.length ? 'Try another search or status.' : superAdmin ? 'Add a business to manage its profile, billing, and allowances.' : 'Organizations will appear when they are onboarded.'}</p>{rows.length > 0 && <button className="secondary-button" onClick={() => { setSearch(''); setFilter('all') }}>Clear filters</button>}</div>}
      <div className="platform-table-footer"><span>{visible.length} of {rows.length} organizations</span><span>Subscription rates are recorded billing terms.</span></div>
    </section>{owner && <OwnerCredentialsPopover owner={owner} done={() => setOwner(null)} />}
  </div>
}

function OrganizationPage({ id, superAdmin, back }: { id: string; superAdmin: boolean; back: () => void }) {
  const detail = useQuery<OrganizationDetail>({ queryKey: ['platform-organization', id], queryFn: () => platformRequest(`organizations/${id}`), retry: false })
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => { if (detail.isSuccess) heading.current?.focus({ preventScroll: true }) }, [id, detail.isSuccess])
  if (detail.isPending) return <div className="platform-organizations"><button className="back-link icon-button" onClick={back}><ArrowLeft size={16} />Organizations</button><p className="platform-empty" role="status">Loading organization…</p></div>
  if (detail.isError) return <div className="platform-organizations"><button className="back-link icon-button" onClick={back}><ArrowLeft size={16} />Organizations</button><section className="platform-section"><p role="alert">{detail.error.message}</p><button className="secondary-button" onClick={() => void detail.refetch()}>Try again</button></section></div>
  const org = detail.data
  return <div className="platform-organizations platform-organization-page">
    <button className="platform-back back-link icon-button" onClick={back}><ArrowLeft size={16} aria-hidden="true" />Organizations</button>
    <header className="platform-identity"><OrganizationMark row={org} /><div><span className="platform-kicker">{org.organization_type} / {org.location_label || 'Location not provided'}</span><h1 ref={heading} tabIndex={-1}>{org.name}</h1><a href={org.login_url} target="_blank" rel="noreferrer">{new URL(org.login_url).hostname}<ArrowUpRight size={14} aria-hidden="true" /></a></div><button className="secondary-button platform-detail-refresh icon-button" disabled={detail.isFetching} onClick={() => void detail.refetch()} aria-label="Refresh organization"><RefreshCw size={14} aria-hidden="true" /></button><SetupStatus org={org} /></header>
    <nav className="platform-detail-nav" aria-label="Organization detail sections"><a href="#organization-billing">Billing</a><a href="#organization-capacity">Capacity</a><a href="#organization-profile">Business profile</a><a href="#organization-subdomain">Subdomain</a><a href="#organization-controls">Controls</a></nav>
    <div className="platform-detail-grid"><div className="platform-detail-primary">
      <OrganizationSubdomain key={`${org.id}:${org.version}`} org={org} superAdmin={superAdmin} />
      <BillingSection org={org} superAdmin={superAdmin} />
      <section className="platform-section" id="organization-capacity"><div className="platform-section-heading"><div><span className="platform-kicker">02 / ALLOWANCES</span><h2>Stores & employees</h2></div>{superAdmin && <LimitEditor row={org} />}</div><div className="platform-capacity-grid">{[{ label: 'Stores', used: org.stores, limit: org.store_limit, icon: <Store size={18} />, note: 'Includes inactive stores' }, { label: 'Employee seats', used: org.active_employees, limit: org.employee_limit, icon: <Users size={18} />, note: 'Active organization memberships' }].map(item => <div className="platform-capacity" key={item.label}><span>{item.icon}{item.label}</span><strong>{item.used}<small> / {item.limit}</small></strong><div className="platform-meter"><span style={{ width: `${Math.min(100, item.used / item.limit * 100)}%` }} /></div><small>{item.note}</small></div>)}</div>{org.store_limit_requests.length > 0 && <div className="platform-requests"><h3>Store allowance requests</h3>{org.store_limit_requests.map(request => <div key={request.id}><strong>{request.current_limit} → {request.requested_limit} stores</strong><small>{new Date(request.created).toLocaleDateString()}</small><p>{request.reason}</p></div>)}</div>}</section>
      <section className="platform-section" id="organization-profile"><div className="platform-section-heading"><div><span className="platform-kicker">03 / BUSINESS</span><h2>Business profile</h2></div></div><dl className="platform-field-grid"><Field label="Organization type">{org.organization_type}</Field><Field label="Location">{org.location_label}</Field><Field label="Store currency">{org.currency}</Field><Field label="Timezone">{org.timezone}</Field><Field label="Website">{org.website_url && <a href={org.website_url} target="_blank" rel="noreferrer">{org.website_url}<ArrowUpRight size={13} /></a>}</Field><Field label="Coordinates">{org.latitude !== null && org.longitude !== null ? `${org.latitude.toFixed(5)}, ${org.longitude.toFixed(5)}` : null}</Field></dl></section>
    </div><aside className="platform-detail-secondary" aria-label="Organization contacts and access"><section className="platform-section"><div className="platform-section-heading"><h2>Administrator</h2></div><dl className="platform-field-stack"><Field label="Name">{org.owner_name}</Field><Field label="Job title">{org.owner_title}</Field><Field label="Email">{org.contact_email && <a href={`mailto:${org.contact_email}`}>{org.contact_email}</a>}</Field><Field label="Phone">{org.owner_phone && <a href={`tel:${org.owner_phone}`}>{org.owner_phone}</a>}</Field></dl></section><section className="platform-section"><div className="platform-section-heading"><h2>Business contact</h2></div><dl className="platform-field-stack"><Field label="Phone">{org.phone && <a href={`tel:${org.phone}`}>{org.phone}</a>}</Field><Field label="Subdomain">{org.subdomain_enabled ? org.slug : 'Not enabled'}</Field><Field label="Sign-in address"><a href={org.login_url} target="_blank" rel="noreferrer">{org.login_url}</a></Field></dl><a className="platform-workspace-link" href={org.login_url} target="_blank" rel="noreferrer">Open workspace sign-in<ArrowUpRight size={15} /></a></section></aside></div>
    <section className="platform-section platform-controls" id="organization-controls"><div className="platform-section-heading"><div><span className="platform-kicker">04 / ADMINISTRATION</span><h2>Platform controls</h2></div><span className="platform-status">{superAdmin ? 'Super admin' : 'View only'}</span></div>{superAdmin ? <details><summary>Organization deletion</summary><DeleteOrganization row={org} deleted={back} /></details> : <p className="muted">A platform super admin manages billing terms, payments, allowances, and organization deletion.</p>}</section>
  </div>
}

function BillingSection({ org, superAdmin }: { org: OrganizationDetail; superAdmin: boolean }) {
  const billing = useQuery<Billing>({ queryKey: ['platform-billing', org.id], queryFn: () => platformRequest(`organizations/${org.id}/billing`), retry: false })
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [voiding, setVoiding] = useState<string | null>(null)
  const configured = org.billing_amount_minor !== null
  return <section className="platform-section platform-billing" id="organization-billing"><div className="platform-section-heading"><div><span className="platform-kicker">01 / COMMERCIAL</span><h2>Billing & payments</h2></div>{superAdmin && !org.deletion_scheduled_for && !editing && <button className="secondary-button" onClick={() => setEditing(true)}>{configured ? 'Edit billing' : 'Set up billing'}</button>}</div>
    {editing ? <BillingForm key={org.version} org={org} close={() => setEditing(false)} /> : <div className="platform-billing-summary"><div><span className="platform-label">Subscription rate</span><strong className={configured ? '' : 'is-unset'}>{rate(org)}</strong>{configured ? <small>{org.billing_interval === 'yearly' ? 'Per year' : 'Per month'} · {org.billing_plan}</small> : <small>Add the agreed plan and fee.</small>}</div><div><span className="platform-label">Recorded payments</span>{billing.isPending ? <span role="status">Loading…</span> : billing.isError ? <span className="platform-unset">Unavailable</span> : billing.data.recorded_totals.length ? billing.data.recorded_totals.map(total => <strong key={total.currency}>{money(total.amount_minor, total.currency)}</strong>) : <strong className="is-unset">None recorded</strong>}<small>All time · voided entries excluded</small></div></div>}
    <div className="platform-payment-heading"><h3>Payment history</h3><button className="platform-text-button" disabled={billing.isFetching} onClick={() => void billing.refetch()} aria-label="Refresh payment history"><RefreshCw size={14} aria-hidden="true" />Refresh</button>{superAdmin && !org.deletion_scheduled_for && !adding && <button className="platform-text-button" onClick={() => setAdding(true)}><Plus size={15} />Record payment</button>}</div>
    {adding && <PaymentForm org={org} close={() => setAdding(false)} />}
    {billing.isPending ? <p className="muted" role="status">Loading payment history…</p> : billing.isError ? <div><p role="alert">{billing.error.message}</p><button className="secondary-button" onClick={() => void billing.refetch()}>Try again</button></div> : billing.data.payments.length ? <div className="platform-table-scroll"><table className="platform-table platform-payments-table"><caption className="sr-only">Latest 50 manually recorded organization payments</caption><thead><tr><th scope="col">Received</th><th scope="col">Amount</th><th scope="col">Method / reference</th><th scope="col">Status</th>{superAdmin && <th scope="col"><span className="sr-only">Actions</span></th>}</tr></thead><tbody>{billing.data.payments.map(payment => <tr key={payment.id}><td>{payment.paid_on}</td><td className="platform-rate">{money(payment.amount_minor, payment.currency)}</td><td>{payment.method.replaceAll('_', ' ')}<small>{payment.reference || 'No reference'}</small></td><td><span className={`platform-status ${payment.voided_at ? 'is-pending' : ''}`}>{payment.voided_at ? 'Voided' : 'Recorded'}</span>{payment.void_reason && <small>{payment.void_reason}</small>}</td>{superAdmin && <td>{!payment.voided_at && <button className="platform-text-button" aria-label={`Void payment of ${money(payment.amount_minor, payment.currency)} on ${payment.paid_on}`} onClick={() => setVoiding(payment.id)}>Void</button>}</td>}</tr>)}</tbody></table><span className="platform-history-note">Latest 50 entries. Totals include all recorded payments.</span></div> : <div className="platform-payment-empty"><CreditCard size={20} aria-hidden="true" /><span>No payments recorded yet.</span></div>}
    {voiding && <VoidPaymentForm organizationId={org.id} paymentId={voiding} close={() => setVoiding(null)} />}
    <p className="platform-billing-note">Payments are recorded manually. Recording an entry does not charge the organization.</p>
  </section>
}

function useBillingSave(organizationId: string, close: () => void) {
  const cache = useQueryClient()
  const verify = usePlatformStepUp()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const save = async (path: string, method: string, body: object) => {
    setBusy(true); setError('')
    try {
      await verify(async () => {
        await platformRequest(`organizations/${organizationId}/${path}`, method, body)
        await Promise.all([cache.invalidateQueries({ queryKey: ['platform-billing', organizationId] }), cache.invalidateQueries({ queryKey: ['platform-organization', organizationId] }), cache.invalidateQueries({ queryKey: ['platform-organizations'] })])
        close()
      })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save billing changes.') }
    finally { setBusy(false) }
  }
  return { busy, error, setError, save }
}
function BillingForm({ org, close }: { org: OrganizationDetail; close: () => void }) {
  const { busy, error, setError, save } = useBillingSave(org.id, close)
  const [currency, setCurrency] = useState(org.billing_currency || org.currency)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    try { void save('billing', 'PUT', { plan: form.get('plan'), currency, amount_minor: minorAmount(String(form.get('amount')), currency), interval: form.get('interval'), expected_version: org.version }) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Enter a valid amount.') }
  }
  return <form className="platform-billing-form" onSubmit={submit}><fieldset disabled={busy}><legend>Agreed subscription terms</legend><label>Plan name<input name="plan" defaultValue={org.billing_plan || ''} placeholder="e.g. Retail monthly" required maxLength={80} /></label><label>Billing cycle<select name="interval" defaultValue={org.billing_interval || 'monthly'}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label><label>Currency<select value={currency} onChange={event => setCurrency(event.target.value)}>{currencies.map(code => <option key={code}>{code}</option>)}</select></label><label>Subscription amount<input name="amount" inputMode="decimal" defaultValue={org.billing_amount_minor === null ? '' : String(org.billing_amount_minor / (org.billing_currency === 'JPY' ? 1 : 100))} placeholder="0.00" required /></label></fieldset>{error && <p role="alert" className="platform-form-error">{error}</p>}<div className="platform-form-actions"><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save billing terms'}</button><button className="secondary-button" type="button" disabled={busy} onClick={close}>Cancel</button></div></form>
}
function PaymentForm({ org, close }: { org: OrganizationDetail; close: () => void }) {
  const { busy, error, setError, save } = useBillingSave(org.id, close)
  const [currency, setCurrency] = useState(org.billing_currency || org.currency)
  const [clientKey] = useState(() => crypto.randomUUID())
  const today = new Date().toISOString().slice(0, 10)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    try {
      const amount = minorAmount(String(form.get('amount')), currency)
      if (amount <= 0) throw new Error('Payment amount must be greater than zero.')
      void save('payments', 'POST', { amount_minor: amount, currency, paid_on: form.get('paid_on'), method: form.get('method'), reference: form.get('reference'), client_key: clientKey })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Enter a valid amount.') }
  }
  return <form className="platform-billing-form" onSubmit={submit}><fieldset disabled={busy}><legend>Record a payment already received</legend><label>Amount<input name="amount" inputMode="decimal" placeholder="0.00" required /></label><label>Currency<select value={currency} onChange={event => setCurrency(event.target.value)}>{currencies.map(code => <option key={code}>{code}</option>)}</select></label><label>Received date<input name="paid_on" type="date" defaultValue={today} max={today} required /></label><label>Payment method<select name="method"><option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option><option value="wallet">Wallet</option><option value="other">Other</option></select></label><label className="platform-form-wide">Reference<input name="reference" placeholder="Transfer reference or receipt number" maxLength={120} /></label></fieldset>{error && <p role="alert" className="platform-form-error">{error}</p>}<div className="platform-form-actions"><button className="primary-button" disabled={busy}>{busy ? 'Recording…' : 'Save received payment'}</button><button className="secondary-button" type="button" disabled={busy} onClick={close}>Cancel</button></div></form>
}
function VoidPaymentForm({ organizationId, paymentId, close }: { organizationId: string; paymentId: string; close: () => void }) {
  const { busy, error, save } = useBillingSave(organizationId, close)
  return <form className="platform-billing-form" onSubmit={event => { event.preventDefault(); void save(`payments/${paymentId}/void`, 'POST', { reason: new FormData(event.currentTarget).get('reason') }) }}><fieldset disabled={busy}><legend>Void this recorded payment</legend><label className="platform-form-wide">Reason<input name="reason" required maxLength={240} placeholder="e.g. Duplicate entry" /></label></fieldset><p className="platform-billing-note">This excludes the entry from totals. It does not issue a refund.</p>{error && <p className="platform-form-error" role="alert">{error}</p>}<div className="platform-form-actions"><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Void entry'}</button><button type="button" className="secondary-button" disabled={busy} onClick={close}>Cancel</button></div></form>
}
