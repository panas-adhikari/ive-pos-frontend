import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { identity } from './session'
import { setupRequest } from './organization-api'

type Setup = { organization: { configured: boolean; name: string; store_limit: number; employee_limit: number }; stores: { active: boolean; registers: { active: boolean }[] }[] }

export function OrganizationOnboarding({ openSection }: { openSection: (section: 'setup' | 'people') => void }) {
  const account = useQuery({ queryKey: ['identity'], queryFn: identity })
  const [selected, setSelected] = useState('')
  const memberships = account.data?.memberships.filter(m => m.permissions.includes('organization.setup')) || []
  const member = memberships.find(m => m.organization_id === selected) || memberships[0]
  const setup = useQuery<Setup>({ queryKey: ['store-setup', member?.organization_id],
    queryFn: () => setupRequest(`${member!.organization_id}/setup`), enabled: !!member, retry: false })
  if (!member) return <section className="panel"><h2>Your organization access</h2><p>Your administrator has assigned your role and store access. Contact them for changes.</p></section>
  const stores = setup.data?.stores.filter(s => s.active) || []
  const steps = [
    { label: 'Verify your email', done: !!account.data?.email_verified },
    { label: 'Enable MFA from Account security in your account menu', done: !!account.data?.mfa_enabled },
    { label: 'Confirm business details in Organization Settings', done: !!setup.data?.organization.configured },
    { label: 'Create your first active store', done: stores.length > 0 },
    { label: 'Add an active register', done: stores.some(s => s.registers.some(r => r.active)) },
  ]
  const activeRegisters = stores.reduce((total, store) => total + store.registers.filter(register => register.active).length, 0)
  return <div className="organization-dashboard">
    {memberships.length > 1 && <div className="dashboard-organization-select"><label>Organization<select value={member.organization_id} onChange={e => setSelected(e.target.value)}>{memberships.map(m => <option key={m.organization_id} value={m.organization_id}>{m.name}</option>)}</select></label></div>}
    {setup.isPending ? <p role="status">Loading dashboard…</p> : setup.isError ? <p role="alert">{setup.error.message}</p> : <>
      <div className="dashboard-grid"><article className="metric-card"><p>Active stores</p><strong>{stores.length}</strong><small>of {setup.data.organization.store_limit} allowed</small></article><article className="metric-card"><p>Active registers</p><strong>{activeRegisters}</strong><small>Across all active stores</small></article><article className="metric-card"><p>Employee allowance</p><strong>{setup.data.organization.employee_limit}</strong><small>Assigned organization limit</small></article><article className="metric-card"><p>Setup progress</p><strong>{steps.filter(step => step.done).length} / {steps.length}</strong><small>Steps completed</small></article></div>
      <div className="dashboard-columns"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">FUTURE REPORTING</p><h2>Operational trends</h2></div><span className="demo-label">COMING SOON</span></div><div className="dashboard-empty-chart"><span>Sales, inventory and activity graphs will appear as operations are added.</span></div></section><section className="panel"><div className="panel-heading"><div><p className="eyebrow">GET READY</p><h2>Organization setup</h2></div></div><p className="muted">{steps.filter(step => step.done).length} of {steps.length} steps complete</p><ul className="readiness-list">{steps.map(step => <li key={step.label} className={step.done ? 'done' : 'todo'}>{step.label}</li>)}</ul></section></div>
    </>}
    <div className="dashboard-quick-actions"><button className="primary-button icon-button" onClick={() => openSection('setup')}>Manage stores<ArrowRight aria-hidden="true" /></button><button className="secondary-button icon-button" onClick={() => openSection('people')}>People and Access<ArrowRight aria-hidden="true" /></button></div>
  </div>
}
