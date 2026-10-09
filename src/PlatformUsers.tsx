import './account-workflows.css'
import './platform-organizations.css'
import './platform-users.css'
import { ArrowDown, ArrowUp, Check, RefreshCw, Search, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { platformRequest } from './platform-api'
import { usePlatformStepUp } from './PlatformStepUp'

type Staff = { id: string; email: string; full_name: string; job_title: string; role: string; active: boolean; must_change_password: boolean; email_verified: boolean; mfa_enabled: boolean }

function readiness(user: Staff) {
  if (!user.active) return { label: 'Inactive', tone: 'inactive', key: 'inactive' }
  if (user.must_change_password) return { label: 'First sign-in pending', tone: 'pending', key: 'pending' }
  if (!user.email_verified) return { label: 'Verify email', tone: 'pending', key: 'pending' }
  if (!user.mfa_enabled) return { label: 'Set up MFA', tone: 'pending', key: 'pending' }
  return { label: 'Ready', tone: 'ready', key: 'ready' }
}
function initials(user: Staff) {
  return (user.full_name.trim() || user.email).split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
}

export default function PlatformUsers() {
  const cache = useQueryClient()
  const runCritical = usePlatformStepUp()
  const staff = useQuery<Staff[]>({ queryKey: ['platform-staff'], queryFn: () => platformRequest('staff'), retry: false })
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [descending, setDescending] = useState(false)
  const users = staff.data || []
  const rows = users.filter(user => (!search.trim() || `${user.full_name} ${user.email} ${user.job_title}`.toLowerCase().includes(search.trim().toLowerCase())) && (role === 'all' || user.role === role) && (status === 'all' || readiness(user).key === status)).sort((a, b) => ((a.full_name || a.email).localeCompare(b.full_name || b.email) || a.email.localeCompare(b.email)) * (descending ? -1 : 1))
  function clearFilters() { setSearch(''); setRole('all'); setStatus('all') }
  const [mode, setMode] = useState<'new' | 'existing' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const body = mode === 'existing' ? { email: values.get('email') } : {
      email: values.get('email'), full_name: values.get('full_name'), job_title: values.get('job_title'),
      temporary_password: values.get('temporary_password'),
    }
    setBusy(true); setError(''); setMessage('')
    try {
      await runCritical(async () => {
        await platformRequest(mode === 'existing' ? 'employees' : 'staff', 'POST', body)
        form.reset()
        setMessage(mode === 'existing' ? 'Platform staff access granted.' : 'Staff account created. Share the temporary password securely. On first sign-in, they must choose a new password, then verify their email and set up MFA in Profile & Security.')
        setMode(null)
        await cache.invalidateQueries({ queryKey: ['platform-staff'] })
      })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to onboard staff.') }
    finally { setBusy(false) }
  }
  return <section className="platform-organizations platform-users-page" aria-labelledby="platform-users-title">
    <header className="platform-page-heading">
      <div><span className="platform-kicker">Platform / Access</span><h1 id="platform-users-title">Platform users</h1><p>Staff accounts and access readiness.</p></div>
      <div className="platform-heading-actions">
        <button className="secondary-button" disabled={staff.isFetching} onClick={() => void staff.refetch()}><RefreshCw size={14} aria-hidden="true" />Refresh</button>
        <button className="secondary-button" disabled={busy} onClick={() => { setMode('existing'); setError(''); setMessage('') }}>Add existing account</button>
        <button className="primary-button" disabled={busy} onClick={() => { setMode('new'); setError(''); setMessage('') }}><UserPlus size={15} aria-hidden="true" />Onboard staff</button>
      </div>
    </header>
    {staff.isSuccess && <div className="platform-directory-summary" aria-label="Staff summary">
      <span><strong>{users.length}</strong> total users</span>
      <span><strong>{users.filter(user => readiness(user).key === 'ready').length}</strong> ready</span>
      <span><strong>{users.filter(user => readiness(user).key === 'pending').length}</strong> setup pending</span>
      <span><strong>{users.filter(user => !user.active).length}</strong> inactive</span>
    </div>}
    {mode && <form className="account-profile-form platform-staff-form" onSubmit={submit}>
      <h3>{mode === 'new' ? 'New platform staff' : 'Add existing account'}</h3>
      <p className="muted">{mode === 'new' ? 'Staff receive platform employee access. Save the temporary password before creating the account.' : 'Enter an active account with a verified email. Its organization memberships stay unchanged.'}</p>
      {mode === 'new' && <label>Full name<input name="full_name" required maxLength={160} autoComplete="name" /></label>}
      <label>Email address<input name="email" type="email" required maxLength={254} autoComplete="off" /></label>
      {mode === 'new' && <><label>Job title<input name="job_title" maxLength={100} /></label><label>Temporary password<input name="temporary_password" type="password" required minLength={15} maxLength={128} autoComplete="new-password" /><small>Use 15–128 characters. The staff member must change it on first sign-in.</small></label></>}
      <div className="compact-heading-actions"><button className="primary-button" disabled={busy}>{busy ? 'Saving…' : mode === 'new' ? 'Create staff account' : 'Grant platform access'}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => { setMode(null); setError('') }}>Cancel</button></div>
    </form>}
    {error && <p role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <div className="platform-directory platform-user-directory">
      <div className="platform-table-toolbar">
        <label className="platform-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Search platform users</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, email, or job title" /></label>
        <label><span className="sr-only">Platform role</span><select value={role} onChange={event => setRole(event.target.value)}><option value="all">All roles</option><option value="super_admin">Super administrators</option><option value="employee">Platform employees</option></select></label>
        <label><span className="sr-only">Account status</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option><option value="ready">Ready</option><option value="pending">Setup pending</option><option value="inactive">Inactive</option></select></label>
        <button className="secondary-button platform-user-mobile-sort" aria-label={`Sort users by name ${descending ? 'ascending' : 'descending'}`} onClick={() => setDescending(value => !value)}>Name {descending ? 'Z–A' : 'A–Z'}{descending ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" />}</button>
      </div>
      {staff.isPending ? <div className="platform-empty" role="status">Loading platform users…</div> : staff.isError ? <div className="platform-empty"><p role="alert">{staff.error.message}</p><button className="secondary-button" onClick={() => void staff.refetch()}>Try again</button></div> : !rows.length ? <div className="platform-empty"><Users size={28} aria-hidden="true" /><h2>{users.length ? 'No matching users' : 'No platform users yet'}</h2><p>{users.length ? 'Try another search or clear the filters.' : 'Onboard a staff member or grant access to an existing account.'}</p>{users.length > 0 && <button className="secondary-button" onClick={clearFilters}>Clear filters</button>}</div> : <div className="platform-table-scroll" tabIndex={0} role="region" aria-label="Platform user directory">
        <table className="platform-table platform-users-table"><caption className="sr-only">Platform staff accounts and security setup</caption>
          <thead><tr><th scope="col" aria-sort={descending ? 'descending' : 'ascending'}><button className="platform-user-sort" onClick={() => setDescending(value => !value)} aria-label={`Sort users by name ${descending ? 'ascending' : 'descending'}`}>User{descending ? <ArrowDown size={12} aria-hidden="true" /> : <ArrowUp size={12} aria-hidden="true" />}</button></th><th scope="col">Platform role</th><th scope="col">Account status</th><th scope="col">Security setup</th></tr></thead>
          <tbody>{rows.map(user => { const state = readiness(user); return <tr key={user.id}>
            <th scope="row"><div className="platform-user-person"><span className="platform-user-avatar" aria-hidden="true">{initials(user)}</span><div><strong>{user.full_name || 'Unnamed account'}</strong><span>{user.email}</span>{user.job_title && <small>{user.job_title}</small>}</div></div></th>
            <td><span className={`platform-user-role ${user.role === 'super_admin' ? 'is-admin' : ''}`}>{user.role === 'super_admin' && <ShieldCheck size={14} aria-hidden="true" />}{user.role === 'super_admin' ? 'Super administrator' : 'Platform employee'}</span></td>
            <td><span className={`platform-user-state is-${state.tone}`}><span aria-hidden="true" />{state.label}</span>{user.must_change_password && !user.active && <small>Password change required</small>}</td>
            <td><div className="platform-user-security"><span className={user.email_verified ? 'is-complete' : 'is-incomplete'}>{user.email_verified ? <Check size={12} aria-hidden="true" /> : <span className="platform-security-dot" aria-hidden="true" />}Email {user.email_verified ? 'verified' : 'pending'}</span><span className={user.mfa_enabled ? 'is-complete' : 'is-incomplete'}>{user.mfa_enabled ? <Check size={12} aria-hidden="true" /> : <span className="platform-security-dot" aria-hidden="true" />}MFA {user.mfa_enabled ? 'enabled' : 'pending'}</span></div></td>
          </tr> })}</tbody>
        </table>
      </div>}
      {staff.isSuccess && <footer className="platform-table-footer" aria-live="polite"><span>{rows.length} of {users.length} users</span><span>Platform access only</span></footer>}
    </div>
  </section>
}
