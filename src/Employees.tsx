import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Search, ShieldCheck, UserPlus, UsersRound, X } from 'lucide-react'
import { identity } from './session'
import type { Identity } from './session'
import { setupRequest } from './organization-api'
import { InvitationList } from './Invitations'
import { OrganizationStepUpProvider, useOrganizationStepUp } from './PlatformStepUp'
import './employees.css'

type Member = {
  id: string; user_id: string; email: string; roles: string[]; permissions: string[];
  all_stores: boolean; store_ids: string[]; active: boolean; version: number
}
type Directory = {
  memberships: Member[]; stores: { id: string; name: string; active: boolean }[];
  roles: Record<string, string[]>; role_all_stores: string[]; grantable_permissions: string[]
}
const names: Record<string, string> = {
  owner: 'Owner', organization_admin: 'Organization admin', administrator: 'Organization admin',
  store_admin: 'Store admin', store_manager: 'Store manager', cashier: 'Cashier',
  inventory_manager: 'Inventory manager', accountant: 'Accountant', custom: 'Custom',
  'organization.read': 'View business', 'organization.setup': 'Manage business and stores',
  'employees.manage': 'Manage employees', 'store.read': 'View assigned stores and registers',
  'catalog.manage': 'Manage catalog', 'inventory.manage': 'Receive and manage stock',
  'sales.create': 'Use terminal', 'reports.read': 'View reports and stock history',
}

export default function Employees() {
  const account = useQuery({ queryKey: ['identity'], queryFn: identity, retry: false })
  const [organizationId, setOrganizationId] = useState('')
  const memberships = account.data?.memberships.filter(member => member.permissions.includes('employees.manage')) || []
  const selected = memberships.find(member => member.organization_id === organizationId) || memberships[0]
  if (!account.data) return <p role="status">Loading people…</p>
  if (!selected) return <section className="panel"><p>You do not have access to manage staff for this organization.</p></section>
  return <section className="people-page" aria-label="People and access">
    <div className="people-page-heading"><div><h2>People &amp; access</h2><p>Invite staff and manage where they can work.</p></div>
      {memberships.length > 1 && <label>Organization<select value={selected.organization_id} onChange={event => setOrganizationId(event.target.value)}>
        {memberships.map(member => <option key={member.organization_id} value={member.organization_id}>{member.name}</option>)}
      </select></label>}
    </div>
    <OrganizationStepUpProvider key={selected.organization_id}>
      <DirectoryView organizationId={selected.organization_id} account={account.data} />
    </OrganizationStepUpProvider>
  </section>
}

function DirectoryView({ organizationId, account }: { organizationId: string; account: Identity }) {
  const cache = useQueryClient()
  const runCritical = useOrganizationStepUp()
  const query = useQuery<Directory>({ queryKey: ['employees', organizationId],
    queryFn: () => setupRequest(`${organizationId}/employees`), retry: false })
  const [editor, setEditor] = useState<Member | 'new' | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'suspended'>('all')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')

  async function reload() {
    await query.refetch()
    await cache.invalidateQueries({ queryKey: ['identity'] })
  }
  async function save(body: object, member?: Member) {
    setBusy(true); setError(''); setMessage('')
    try {
      await runCritical(async () => {
        try {
          await setupRequest(`${organizationId}/${member ? 'employees/' + member.id : 'invitations'}`, member ? 'PUT' : 'POST', body)
          setEditor(null)
          await reload()
          await cache.invalidateQueries({ queryKey: ['invitations'] })
          setMessage(member ? 'Employee access saved.' : 'Invitation queued for email delivery.')
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to confirm changes. Reload before retrying.') }
      })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to confirm changes. Reload before retrying.') }
    finally { setBusy(false) }
  }
  if (query.isPending) return <p role="status">Loading staff directory…</p>
  if (query.isError) return <section className="panel"><p role="alert">{query.error.message}</p><button className="secondary-button" onClick={() => void reload()}>Reload directory</button></section>
  const data = query.data
  const activeCount = data.memberships.filter(member => member.active).length
  const term = search.trim().toLocaleLowerCase()
  const shown = data.memberships.filter(member =>
    (filter === 'all' || member.active === (filter === 'active')) &&
    (!term || member.email.toLocaleLowerCase().includes(term) || member.roles.some(role => (names[role] || role).toLocaleLowerCase().includes(term)))
  )
  return <>
    <div className="people-overview">
      <div className="people-overview-item"><span className="people-overview-icon"><UsersRound size={18} /></span><div><strong>{data.memberships.length}</strong><span>Total staff</span></div></div>
      <div className="people-overview-item"><span className="people-overview-icon"><ShieldCheck size={18} /></span><div><strong>{activeCount}</strong><span>Active access</span></div></div>
      <button className="primary-button icon-button" disabled={busy} onClick={() => { setError(''); setEditor('new') }}><UserPlus aria-hidden="true" />Invite staff</button>
    </div>
    {message && <p role="status" className="people-success">{message}</p>}
    {error && !editor && <div role="alert" className="setup-alert"><p>{error}</p><button className="secondary-button" onClick={() => { setError(''); void reload() }}>Reload latest details</button></div>}
    <section className="panel staff-directory" aria-label="Staff directory">
      <div className="staff-directory-heading"><div><h3>Staff directory</h3><p className="muted">People with access to this organization.</p></div><span className="staff-count">{shown.length} shown</span></div>
      <div className="staff-directory-tools"><label className="staff-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search staff</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by email or role" /></label>
        <div className="staff-filters" role="group" aria-label="Filter staff by status">{(['all', 'active', 'suspended'] as const).map(value => <button key={value} className={filter === value ? 'selected' : ''} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value === 'active' ? 'Active' : 'Suspended'}</button>)}</div></div>
      {shown.length ? <div className="staff-list">{shown.map(member => <article className="staff-row" key={member.id} aria-label={`Employee ${member.email}`}>
        <div className="staff-person"><span className="staff-avatar" aria-hidden="true">{member.email.slice(0, 2).toUpperCase()}</span><div><strong>{member.email}</strong><span>{member.roles.map(role => names[role] || role).join(', ')}{member.user_id === account.id ? ' · You' : ''}</span></div></div>
        <div className="staff-scope"><span className="staff-row-label">Store access</span><span>{member.all_stores ? 'All stores' : member.store_ids.length ? data.stores.filter(store => member.store_ids.includes(store.id)).map(store => store.name).join(', ') || 'Assigned stores' : 'No stores'}</span></div>
        <span className={member.active ? 'staff-status active' : 'staff-status suspended'}>{member.active ? 'Active' : 'Suspended'}</span>
        {member.user_id === account.id ? <span className="staff-self-note">Managed by another admin</span> : <button className="secondary-button" disabled={busy} onClick={() => { setError(''); setEditor(member) }}>Edit access</button>}
      </article>)}</div> : <div className="staff-empty"><UsersRound size={24} aria-hidden="true" /><strong>{data.memberships.length ? 'No staff match your search' : 'No staff yet'}</strong><p>{data.memberships.length ? 'Try another email, role, or status.' : 'Invite your first team member to get started.'}</p>{!data.memberships.length && <button className="secondary-button" onClick={() => setEditor('new')}>Invite staff</button>}</div>}
    </section>
    <InvitationList organizationId={organizationId} />
    {editor && <div className="access-editor-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setEditor(null) }}><div className="access-editor-dialog" role="dialog" aria-modal="true" aria-label={editor === 'new' ? 'Invite staff' : `Edit access for ${editor.email}`}>
      <AccessForm key={editor === 'new' ? 'new' : editor.id} member={editor === 'new' ? undefined : editor} data={data} disabled={busy} error={error} save={save} close={() => { setEditor(null); setError('') }} />
    </div></div>}
  </>
}

function AccessForm({ member, data, disabled, error, save, close }: {
  member?: Member; data: Directory; disabled: boolean; error: string;
  save: (body: object, member?: Member) => Promise<void>; close: () => void
}) {
  const initialRoles = member?.roles || ['cashier']
  const [roles, setRoles] = useState(initialRoles)
  const [permissionOverrides, setPermissionOverrides] = useState<Record<string, boolean>>(() => {
    if (!member) return {}
    const defaults = new Set(member.roles.flatMap(role => data.roles[role] || []))
    return Object.fromEntries(data.grantable_permissions.filter(permission =>
      member.permissions.includes(permission) !== defaults.has(permission)
    ).map(permission => [permission, member.permissions.includes(permission)]))
  })
  const [allStores, setAllStores] = useState(member?.all_stores ?? initialRoles.some(role => data.role_all_stores.includes(role)))
  const [stores, setStores] = useState(member?.store_ids || [])
  const [active, setActive] = useState(member?.active ?? true)
  function toggle(values: string[], value: string) { return values.includes(value) ? values.filter(item => item !== value) : [...values, value] }
  function permissionsFor(selectedRoles: string[]) {
    const defaults = new Set(selectedRoles.flatMap(role => data.roles[role] || []))
    return data.grantable_permissions.filter(permission => permissionOverrides[permission] ?? defaults.has(permission))
  }
  const rolePermissions = new Set(roles.flatMap(role => data.roles[role] || []))
  const permissions = permissionsFor(roles)
  const organizationWide = permissions.includes('employees.manage') || permissions.includes('organization.setup')
  function changeRole(role: string) {
    const selected = toggle(roles, role)
    const next = selected.length ? selected : ['custom']
    setRoles(next)
    const nextPermissions = permissionsFor(next)
    setAllStores(next.some(value => data.role_all_stores.includes(value)) ||
      nextPermissions.includes('employees.manage') || nextPermissions.includes('organization.setup'))
  }
  function changePermission(permission: string) {
    const enabled = !permissions.includes(permission)
    setPermissionOverrides(current => {
      const next = { ...current }
      if (enabled === rolePermissions.has(permission)) delete next[permission]
      else next[permission] = enabled
      return next
    })
    if (enabled && (permission === 'employees.manage' || permission === 'organization.setup')) setAllStores(true)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (member?.active && !active && !window.confirm(`Suspend ${member.email} in this organization?`)) return
    const values = new FormData(event.currentTarget)
    await save({ roles, permissions, all_stores: allStores || organizationWide, store_ids: allStores || organizationWide ? [] : stores, active,
      ...(member ? { expected_version: member.version } : { email: values.get('email') }) }, member)
  }
  return <section className="access-editor" aria-label={member ? 'Edit employee access' : 'Invite staff'}>
    <div className="access-editor-heading"><div><h3>{member ? 'Edit staff access' : 'Invite staff'}</h3><p>{member ? member.email : 'Choose a role and store access before sending the invitation.'}</p></div><button type="button" className="access-editor-close" aria-label="Close editor" disabled={disabled} onClick={close}><X size={19} /></button></div>
    <form onSubmit={submit}>
      <fieldset disabled={disabled} className="access-editor-fields"><legend className="sr-only">Staff access</legend>
        {!member && <div className="access-section"><label className="access-email">Work email<input name="email" type="email" autoComplete="off" required maxLength={254} autoFocus placeholder="name@company.com" /></label><p className="access-help">We’ll email a link to join this organization. It expires in 30 minutes.</p></div>}
        <div className="access-section"><div className="access-section-heading"><div><h4>Roles</h4><p>Select one or more roles. Their permissions and default store access are combined automatically.</p></div></div>
          <div className="access-role-options">{Object.keys(data.roles).concat('custom').map(role => <label key={role} className={roles.includes(role) ? 'access-role selected' : 'access-role'}><input type="checkbox" checked={roles.includes(role)} onChange={() => changeRole(role)} />{names[role] || role}</label>)}</div></div>
        <div className="access-section"><div className="access-section-heading"><div><h4>Permissions</h4><p>Adjust the combined role permissions for this person.</p></div></div><div className="access-permission-grid">{data.grantable_permissions.map(permission => <label className="access-check" key={permission}>
          <input type="checkbox" checked={permissions.includes(permission)} onChange={() => changePermission(permission)} /><span>{names[permission] || permission}<small className="access-permission-note">{permissionOverrides[permission] === undefined ? rolePermissions.has(permission) ? 'From role' : 'Available to add' : 'Customized'}</small></span></label>)}</div></div>
        <div className="access-section"><div className="access-section-heading"><div><h4>Store access</h4><p>Choose which locations this person can see.</p></div></div>
          <label className="access-check"><input type="checkbox" checked={allStores || organizationWide} disabled={organizationWide} onChange={event => setAllStores(event.target.checked)} />All stores, including future stores</label>
          {roles.some(role => data.role_all_stores.includes(role)) && <p className="access-help">Selected by the role. You can change this store access for this person.</p>}
          {!allStores && !organizationWide && <div className="access-store-list">{data.stores.map(store => <label className="access-check" key={store.id}><input type="checkbox" checked={stores.includes(store.id)} onChange={() => setStores(toggle(stores, store.id))} />{store.name}{store.active ? '' : ' (inactive)'}</label>)}{!data.stores.length && <p className="access-help">No stores have been added yet.</p>}</div>}
          {!allStores && !organizationWide && !stores.length && !!data.stores.length && <p className="access-help">No stores selected. This person cannot view a store until one is assigned.</p>}
        </div>
        {member && <div className="access-section access-membership"><div><h4>Membership status</h4><p>Suspending access preserves this person’s record.</p></div><label className="access-check"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} />Active</label></div>}
        {error && <p role="alert" className="access-error">{error}</p>}
        <div className="access-editor-actions"><button className="primary-button">{member ? 'Save access' : 'Send invitation'}</button><button type="button" className="secondary-button" disabled={disabled} onClick={close}>Cancel</button></div>
      </fieldset>
    </form>
  </section>
}
