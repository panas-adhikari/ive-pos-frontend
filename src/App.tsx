import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Building2, ChartNoAxesCombined, ClipboardList, LogOut, Settings2, ShieldCheck, ShoppingCart, Store } from 'lucide-react'
import './App.css'
import './organization-admin.css'
import StoreSetup from './StoreSetup'
import Employees from './Employees'
import { PlatformOverview } from './ControlPanels'
import { Operations, ReportPage, Terminal } from './Operations'
import type { Identity } from './session'
import { identity } from './session'
import { useAccountActions } from './auth'
import { SecurityPanel } from './identity'
import AccountProfile from './AccountProfile'
import { apiUrl } from './api-url'

type Workspace = 'platform' | 'organization' | 'store'
type OrganizationSection = 'terminal' | 'report' | 'operations' | 'stores' | 'people' | 'settings'

async function checkReadiness(): Promise<boolean> {
  const response = await fetch(apiUrl('/api/v1/ready'), { signal: AbortSignal.timeout(6000) })
  if (!response.ok) throw new Error('Service unavailable')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('status' in data) || data.status !== 'ready') throw new Error('Unexpected service response')
  return true
}

const workspaces: { id: Workspace; label: string; description: string }[] = [
  { id: 'platform', label: 'Platform control', description: 'Onboard and support organizations' },
  { id: 'organization', label: 'Organization admin', description: 'Manage one business and its team' },
  { id: 'store', label: 'Store operations', description: 'Run one location and its counters' },
]

function App() {
  const accountActions = useAccountActions()
  const [workspace, setWorkspace] = useState<Workspace>('organization')
  const [organizationSection, setOrganizationSection] = useState<OrganizationSection | null>(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [accountPage, setAccountPage] = useState(false)
  const account = useQuery({ queryKey: ['identity'], queryFn: identity, retry: false })
  const readiness = useQuery({ queryKey: ['service-readiness'], queryFn: checkReadiness,
    retry: false, staleTime: 30_000, refetchInterval: 30_000 })
  const connected = readiness.data && !readiness.isError
  const platformRole = account.data?.platform_role ?? 'none'
  const platformAccess = platformRole !== 'none'
  const organizationAccess = !!account.data?.memberships.length
  const storeAccess = !!account.data?.memberships.some(member => member.permissions.includes('store.read'))
  const terminalAccess = !!account.data?.memberships.some(member => member.permissions.includes('sales.create'))
  const reportAccess = !!account.data?.memberships.some(member => member.permissions.includes('reports.read'))
  const operationsAccess = !!account.data?.memberships.some(member => ['catalog.manage', 'inventory.manage', 'reports.read'].some(permission => member.permissions.includes(permission)))
  const selectedSection = organizationSection === 'terminal' && !terminalAccess || organizationSection === 'report' && !reportAccess || organizationSection === 'operations' && !operationsAccess
    ? null : organizationSection
  const activeSection = selectedSection || (terminalAccess ? 'terminal' : reportAccess ? 'report' : operationsAccess ? 'operations' : 'stores')
  const visibleWorkspaces = workspaces.filter(item => item.id === 'platform' ? platformAccess : item.id === 'organization' ? organizationAccess : storeAccess)
  const primaryOrganization = account.data?.memberships[0]
  useEffect(() => {
    if (platformRole !== 'none' && !organizationAccess) setWorkspace('platform')
  }, [platformRole, organizationAccess])
  function openOrganization(section: OrganizationSection) { setWorkspace('organization'); setOrganizationSection(section); setAccountPage(false) }

  return <div className="controller-shell">
    <header className="controller-topbar"><a className="brand" href="#main"><img className="brand-logo" src="/ive-pos-logo.svg" alt="Ive POS" /></a><span className="topbar-context">{accountPage ? 'Your account' : workspace === 'organization' ? 'Organization admin' : workspace === 'platform' ? 'Platform control' : 'Store operations'}</span><div className="topbar-organization">{primaryOrganization ? <>{account.data!.memberships.length === 1 && primaryOrganization.image_url ? <img src={primaryOrganization.image_url} alt="" /> : <span className="topbar-org-mark"><Building2 aria-hidden="true" /></span>}<span><strong>{account.data!.memberships.length > 1 ? `${account.data!.memberships.length} organizations` : primaryOrganization.name}</strong><small>{account.data!.memberships.length > 1 ? 'Available to your account' : primaryOrganization.organization_type}</small></span></> : <><span className="topbar-org-mark"><Building2 aria-hidden="true" /></span><span><strong>Platform</strong><small>Control workspace</small></span></>}<span className={connected ? 'live-dot' : 'live-dot is-off'} title={connected ? 'System connected' : 'Service unavailable'} aria-label={connected ? 'System connected' : 'Service unavailable'} /></div></header>
    <div className="controller-layout"><aside className="controller-sidebar" aria-label="Workspace navigation">
      {workspace === 'organization' && organizationAccess ? <><p className="sidebar-label">ORGANIZATION</p><nav aria-label="Organization navigation">{([
        ...(terminalAccess ? [{ id: 'terminal' as const, label: 'Terminal', icon: <ShoppingCart /> }] : []),
        ...(reportAccess ? [{ id: 'report' as const, label: 'Report', icon: <ChartNoAxesCombined /> }] : []),
        ...(operationsAccess ? [{ id: 'operations' as const, label: 'Operations', icon: <ClipboardList /> }] : []),
        { id: 'stores', label: 'Stores', icon: <Store /> },
        { id: 'people', label: 'People and Access', icon: <ShieldCheck /> },
        { id: 'settings', label: 'Organization Settings', icon: <Settings2 /> },
      ] as const).map(item => <button key={item.id} className={!accountPage && activeSection === item.id ? 'workspace-link active' : 'workspace-link'} aria-current={!accountPage && activeSection === item.id ? 'page' : undefined} onClick={() => { setOrganizationSection(item.id); setAccountPage(false) }}><span className="workspace-icon" aria-hidden="true">{item.icon}</span><strong>{item.label}</strong></button>)}</nav></> : <><p className="sidebar-label">WORKSPACE</p><nav>{visibleWorkspaces.map(item => <button key={item.id} className={!accountPage && workspace === item.id ? 'workspace-link active' : 'workspace-link'} onClick={() => { setWorkspace(item.id); setAccountPage(false) }}><span className="workspace-icon" aria-hidden="true">{item.id === 'platform' ? <Settings2 /> : item.id === 'organization' ? <Building2 /> : <Store />}</span><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}</nav></>}
      {workspace === 'organization' && visibleWorkspaces.length > 1 && <div className="sidebar-workspace-switch"><p className="sidebar-label">OTHER WORKSPACES</p>{visibleWorkspaces.filter(item => item.id !== 'organization').map(item => <button key={item.id} className="workspace-link" onClick={() => { setWorkspace(item.id); setAccountPage(false) }}><span className="workspace-icon" aria-hidden="true">{item.id === 'platform' ? <Settings2 /> : <Store />}</span><strong>{item.label}</strong></button>)}</div>}
      <div className="sidebar-footer"><div className="sidebar-account"><button className={accountPage ? 'sidebar-account-trigger selected' : 'sidebar-account-trigger'} aria-label="Open Profile and Security" aria-current={accountPage ? 'page' : undefined} onClick={() => setAccountPage(true)}><span className="sidebar-account-avatar">{(account.data?.full_name || account.data?.email || 'U').slice(0, 2).toUpperCase()}</span><span className="sidebar-account-copy"><strong>{account.data?.full_name || 'Your account'}</strong><small>{account.data?.email}</small></span></button></div><button className="sidebar-signout icon-button" onClick={() => setConfirmLogout(true)} disabled={accountActions?.busy}><LogOut aria-hidden="true" />Logout</button></div>
    </aside>
      <main id="main" className="controller-main">{accountPage && account.data && accountActions ? <div className="account-settings-page"><div className="account-settings-heading"><h1>Profile &amp; Security</h1></div><AccountProfile account={account.data} /><SecurityPanel email={account.data.email} verified={account.data.email_verified} mfa={account.data.mfa_enabled} emailEnabled={accountActions.emailEnabled} mfaAvailable={accountActions.securityAvailable} refresh={identity} codes={accountActions.securityCodes} signedOut={accountActions.signedOut} changePassword={accountActions.password} /></div> : <>{workspace === 'platform' && platformAccess && <PlatformOverview superAdmin={platformRole === 'super_admin'} />}{workspace === 'organization' && organizationAccess && <OrganizationWorkspace section={activeSection} setSection={setOrganizationSection} memberships={account.data?.memberships || []} />}{workspace === 'store' && storeAccess && <StoreWorkspace memberships={account.data?.memberships || []} openSetup={() => openOrganization('stores')} />}</>}</main>
    </div>
    {confirmLogout && <div className="logout-backdrop" onClick={() => setConfirmLogout(false)}><section className="logout-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-title" onClick={event => event.stopPropagation()}><div className="logout-dialog-icon"><LogOut aria-hidden="true" /></div><h2 id="logout-title">Log out of Ive POS?</h2><p>You’ll need to sign in again to access your workspace.</p><div className="logout-actions"><button className="secondary-button" autoFocus onClick={() => setConfirmLogout(false)}>Stay signed in</button><button className="primary-button" disabled={accountActions?.busy} onClick={() => { setConfirmLogout(false); accountActions?.signOut() }}>Log out</button></div></section></div>}
  </div>
}

function OrganizationWorkspace({ section, setSection, memberships }: { section: OrganizationSection; setSection: (section: OrganizationSection) => void; memberships: Identity['memberships'] }) {
  return <><h1 className="sr-only">{section === 'people' ? 'People and Access' : section === 'settings' ? 'Organization Settings' : section[0].toUpperCase() + section.slice(1)}</h1>{section === 'stores' && <StoreSetup mode="stores" openSettings={() => setSection('settings')} />}{section === 'terminal' && <Terminal memberships={memberships} />}{section === 'report' && <ReportPage memberships={memberships} />}{section === 'operations' && <Operations memberships={memberships} />}{section === 'people' && <Employees />}{section === 'settings' && <StoreSetup mode="settings" />}</>
}

function StoreWorkspace({ memberships, openSetup }: { memberships: Identity['memberships']; openSetup: () => void }) {
  const [view, setView] = useState<'terminal' | 'operations'>('terminal')
  const canSell = memberships.some(member => member.permissions.includes('sales.create'))
  const canOperate = memberships.some(member => ['catalog.manage', 'inventory.manage', 'reports.read'].some(permission => member.permissions.includes(permission)))
  const activeView = view === 'terminal' && !canSell ? 'operations' : view === 'operations' && !canOperate ? 'terminal' : view
  return <><div className="section-tabs">{canSell && <button className={activeView === 'terminal' ? 'selected' : ''} onClick={() => setView('terminal')}>Terminal</button>}{canOperate && <button className={activeView === 'operations' ? 'selected' : ''} onClick={() => setView('operations')}>Operations</button>}<button onClick={openSetup}>Store setup</button></div>{activeView === 'terminal' && canSell && <Terminal memberships={memberships} />}{activeView === 'operations' && canOperate && <Operations memberships={memberships} />}</>
}
export default App
