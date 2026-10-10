import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { Building2, ChartNoAxesCombined, ClipboardList, LogOut, Settings2, ShieldCheck, ShoppingCart, Store } from 'lucide-react'
import './App.css'
import './organization-admin.css'
import StoreSetup from './StoreSetup'
import AdminQuickSetup from './AdminQuickSetup'
import Employees from './Employees'
import { PlatformOverview } from './ControlPanels'
import PlatformOrganizations from './PlatformOrganizations'
import PlatformUsers from './PlatformUsers'
import { PlatformStepUpProvider } from './PlatformStepUp'
import { Operations, ReportPage, Terminal } from './Operations'
import type { Identity } from './session'
import { identity } from './session'
import { useAccountActions } from './auth'
import { SecurityPanel } from './identity'
import AccountProfile from './AccountProfile'
import { apiUrl } from './api-url'
import { isPlatformPath, isWorkspacePath, navigate, organizationPaths, organizationSectionForPath, platformPaths, usePathname } from './navigation'

type Workspace = 'platform' | 'organization'
type OrganizationSection = 'terminal' | 'report' | 'operations' | 'stores' | 'people' | 'settings' | 'setup'

async function checkReadiness(): Promise<boolean> {
  const response = await fetch(apiUrl('/api/v1/ready'), { signal: AbortSignal.timeout(6000) })
  if (!response.ok) throw new Error('Service unavailable')
  const data: unknown = await response.json()
  if (!data || typeof data !== 'object' || !('status' in data) || data.status !== 'ready') throw new Error('Unexpected service response')
  return true
}

function App() {
  const accountActions = useAccountActions()
  const path = usePathname()
  const organizationSection = organizationSectionForPath(path)
  const platformSection = path === '/organizations' || path.startsWith('/organizations/') ? 'organizations' : path === '/platform/users' ? 'users' : 'overview'
  const [confirmLogout, setConfirmLogout] = useState(false)
  const accountPage = path === '/profile'
  const [setupShowing, setSetupShowing] = useState(false)
  const handleSetupActive = useCallback((active: boolean) => {
    setSetupShowing(active)
    if (active) navigate('/setup', true)
  }, [])
  const account = useQuery({ queryKey: ['identity'], queryFn: identity, retry: false })
  const readiness = useQuery({ queryKey: ['service-readiness'], queryFn: checkReadiness,
    retry: false, staleTime: 30_000, refetchInterval: 30_000 })
  const connected = readiness.data && !readiness.isError
  const platformRole = account.data?.platform_role ?? 'none'
  const platformAccess = platformRole !== 'none'
  const organizationAccess = !!account.data?.memberships.length
  const workspace: Workspace = isPlatformPath(path) && platformAccess ? 'platform' : organizationAccess ? 'organization' : 'platform'
  const terminalAccess = !!account.data?.memberships.some(member => member.permissions.includes('sales.create'))
  const reportAccess = !!account.data?.memberships.some(member => member.permissions.includes('reports.read'))
  const operationsAccess = !!account.data?.memberships.some(member => ['catalog.manage', 'inventory.manage', 'reports.read'].some(permission => member.permissions.includes(permission)))
  const storeSetupAccess = !!account.data?.memberships.some(member => member.all_stores && member.permissions.includes('organization.setup'))
  const organizationPeopleAccess = !!account.data?.memberships.some(member => member.permissions.includes('employees.manage'))
  const managerPeopleAccess = !organizationPeopleAccess && !!account.data?.memberships.some(member => member.roles.some(role => ['store_manager', 'store_admin'].includes(role)))
  const peopleAccess = organizationPeopleAccess || managerPeopleAccess
  const settingsAccess = storeSetupAccess
  const sectionAllowed = useCallback((section: OrganizationSection | null) => section === 'terminal' ? terminalAccess
    : section === 'operations' ? operationsAccess
    : section === 'report' ? reportAccess
    : section === 'stores' ? storeSetupAccess
    : section === 'people' ? peopleAccess
    : section === 'settings' || section === 'setup' ? settingsAccess
    : false, [terminalAccess, operationsAccess, reportAccess, storeSetupAccess, peopleAccess, settingsAccess])
  const selectedSection = sectionAllowed(organizationSection) ? organizationSection : null
  const activeSection = selectedSection || (terminalAccess ? 'terminal' : operationsAccess ? 'operations' : reportAccess ? 'report' : storeSetupAccess ? 'stores' : peopleAccess ? 'people' : 'settings')
  const navigationSection = setupShowing ? 'setup' : activeSection
  const primaryOrganization = account.data?.memberships[0]
  const pageTitle = accountPage ? 'Profile & Security'
    : workspace === 'platform' ? { overview: 'Platform overview', organizations: 'Organizations', users: 'Platform users' }[platformSection]
    : { terminal: 'Terminal', report: 'Reports', operations: 'Inventory', stores: 'Stores & registers', people: managerPeopleAccess ? 'Staff assignments' : 'People & access', settings: 'Organization settings', setup: 'Quick setup' }[navigationSection]
  useEffect(() => {
    document.title = `${pageTitle} — Ive POS`
  }, [pageTitle])
  const organizationHome = sectionAllowed(activeSection) ? organizationPaths[activeSection] : '/profile'
  const defaultPath = organizationAccess ? organizationHome : platformAccess ? '/overview' : '/profile'
  function setOrganizationSection(section: OrganizationSection) { navigate(organizationPaths[section]) }
  function setPlatformSection(section: keyof typeof platformPaths) { navigate(platformPaths[section]) }
  function setWorkspace(next: Workspace) { navigate(next === 'platform' ? '/overview' : organizationHome) }
  const canOpenPath = useCallback((target: string) => {
    if (!isWorkspacePath(target)) return false
    if (target === '/profile') return true
    if (isPlatformPath(target)) {
      return platformAccess && (!['/platform/users', '/organizations/new'].includes(target) || platformRole === 'super_admin')
    }
    return organizationAccess && sectionAllowed(organizationSectionForPath(target))
  }, [platformAccess, platformRole, organizationAccess, sectionAllowed])
  useEffect(() => {
    // Strict Mode can repeat effects after a redirect. Ignore the stale location.
    if (!account.data || path !== (window.location.pathname.replace(/\/$/, '') || '/')) return
    if (['/', '/login', '/app', '/platform'].includes(path)) {
      const next = new URLSearchParams(window.location.search).get('next')
      navigate(path === '/platform' && platformAccess ? '/overview' : next && canOpenPath(next) ? next : defaultPath, true)
    } else if (!canOpenPath(path)) {
      navigate(defaultPath, true)
    }
  }, [path, account.data, platformAccess, defaultPath, canOpenPath])
  return <div className="controller-shell">
    <header className="controller-topbar"><a className="brand" href="#main"><img className="brand-logo" src="/ive-pos-logo.svg" alt="Ive POS" /></a><span className="topbar-context">{accountPage ? 'Your account' : workspace === 'platform' ? 'Platform control' : 'Business workspace'}</span><div className="topbar-organization">{primaryOrganization ? <>{account.data!.memberships.length === 1 && primaryOrganization.image_url ? <img src={primaryOrganization.image_url} alt="" /> : <span className="topbar-org-mark"><Building2 aria-hidden="true" /></span>}<span><strong>{account.data!.memberships.length > 1 ? `${account.data!.memberships.length} organizations` : primaryOrganization.name}</strong><small>{account.data!.memberships.length > 1 ? 'Available to your account' : primaryOrganization.organization_type}</small></span></> : <><span className="topbar-org-mark"><Building2 aria-hidden="true" /></span><span><strong>Platform</strong><small>Control workspace</small></span></>}<span className={connected ? 'live-dot' : 'live-dot is-off'} title={connected ? 'System connected' : 'Service unavailable'} aria-label={connected ? 'System connected' : 'Service unavailable'} /></div></header>
    <div className="controller-layout"><aside className="controller-sidebar" aria-label="Workspace navigation">
      {workspace === 'organization' && organizationAccess ? <div className="sidebar-sections">
        {terminalAccess && <section className="sidebar-section" aria-labelledby="sidebar-operations"><p className="sidebar-label" id="sidebar-operations">OPERATION</p><nav aria-label="Operation navigation">{([
          ...(terminalAccess ? [{ id: 'terminal' as const, label: 'Terminal', icon: <ShoppingCart /> }] : []),
        ] as const).map(item => <button key={item.id} className={!accountPage && navigationSection === item.id ? 'workspace-link active' : 'workspace-link'} aria-current={!accountPage && navigationSection === item.id ? 'page' : undefined} onClick={() => { setOrganizationSection(item.id) }}><span className="workspace-icon" aria-hidden="true">{item.icon}</span><strong>{item.label}</strong></button>)}</nav></section>}
        {(operationsAccess || reportAccess || managerPeopleAccess) && <section className="sidebar-section" aria-labelledby="sidebar-store"><p className="sidebar-label" id="sidebar-store">STORE</p><nav aria-label="Store navigation">{operationsAccess && <button className={!accountPage && navigationSection === 'operations' ? 'workspace-link active' : 'workspace-link'} aria-current={!accountPage && navigationSection === 'operations' ? 'page' : undefined} onClick={() => { setOrganizationSection('operations') }}><span className="workspace-icon" aria-hidden="true"><ClipboardList /></span><strong>Inventory</strong></button>}{reportAccess && <button className={!accountPage && navigationSection === 'report' ? 'workspace-link active' : 'workspace-link'} aria-current={!accountPage && navigationSection === 'report' ? 'page' : undefined} onClick={() => { setOrganizationSection('report') }}><span className="workspace-icon" aria-hidden="true"><ChartNoAxesCombined /></span><strong>Reports</strong></button>}{managerPeopleAccess && <button className={!accountPage && navigationSection === 'people' ? 'workspace-link active' : 'workspace-link'} aria-current={!accountPage && navigationSection === 'people' ? 'page' : undefined} onClick={() => { setOrganizationSection('people') }}><span className="workspace-icon" aria-hidden="true"><ShieldCheck /></span><strong>Staff assignments</strong></button>}</nav></section>}
        {(storeSetupAccess || organizationPeopleAccess || settingsAccess) && <section className="sidebar-section" aria-labelledby="sidebar-organization"><p className="sidebar-label" id="sidebar-organization">ORGANIZATION</p><nav aria-label="Organization navigation">{storeSetupAccess && <button className={!accountPage && navigationSection === 'setup' ? 'workspace-link active' : 'workspace-link'} aria-current={!accountPage && navigationSection === 'setup' ? 'page' : undefined} onClick={() => { setOrganizationSection('setup') }}><span className="workspace-icon" aria-hidden="true"><ClipboardList /></span><strong>Quick setup</strong></button>}{storeSetupAccess && <button className={!accountPage && navigationSection === 'stores' ? 'workspace-link active' : 'workspace-link'} aria-current={!accountPage && navigationSection === 'stores' ? 'page' : undefined} onClick={() => { setOrganizationSection('stores') }}><span className="workspace-icon" aria-hidden="true"><Store /></span><strong>Stores &amp; registers</strong></button>}{organizationPeopleAccess && <button className={!accountPage && navigationSection === 'people' ? 'workspace-link active' : 'workspace-link'} aria-current={!accountPage && navigationSection === 'people' ? 'page' : undefined} onClick={() => { setOrganizationSection('people') }}><span className="workspace-icon" aria-hidden="true"><ShieldCheck /></span><strong>People &amp; access</strong></button>}{settingsAccess && <button className={!accountPage && navigationSection === 'settings' ? 'workspace-link active' : 'workspace-link'} aria-current={!accountPage && navigationSection === 'settings' ? 'page' : undefined} onClick={() => { setOrganizationSection('settings') }}><span className="workspace-icon" aria-hidden="true"><Settings2 /></span><strong>Organization settings</strong></button>}</nav></section>}
      </div> : <div className="sidebar-sections"><section className="sidebar-section"><p className="sidebar-label">PLATFORM</p><nav aria-label="Platform navigation">
        {platformAccess && <>
          <button className={!accountPage && platformSection === 'overview' ? 'workspace-link active' : 'workspace-link'} aria-current={!accountPage && platformSection === 'overview' ? 'page' : undefined} onClick={() => { setPlatformSection('overview') }}><span className="workspace-icon" aria-hidden="true"><ChartNoAxesCombined /></span><strong>Overview</strong></button>
          <button className={!accountPage && platformSection === 'organizations' ? 'workspace-link active' : 'workspace-link'} aria-current={!accountPage && platformSection === 'organizations' ? 'page' : undefined} onClick={() => { setPlatformSection('organizations') }}><span className="workspace-icon" aria-hidden="true"><Building2 /></span><strong>Organizations</strong></button>
          {platformRole === 'super_admin' && <button className={!accountPage && platformSection === 'users' ? 'workspace-link active' : 'workspace-link'} aria-current={!accountPage && platformSection === 'users' ? 'page' : undefined} onClick={() => { setPlatformSection('users') }}><span className="workspace-icon" aria-hidden="true"><ShieldCheck /></span><strong>Platform users</strong></button>}
        </>}
        {organizationAccess && <button className="workspace-link" onClick={() => { setWorkspace('organization') }}><span className="workspace-icon" aria-hidden="true"><Store /></span><strong>Business workspace</strong></button>}
      </nav></section></div>}

      {workspace === 'organization' && platformAccess && <div className="sidebar-workspace-switch"><p className="sidebar-label">PLATFORM</p><button className="workspace-link" onClick={() => { setWorkspace('platform') }}><span className="workspace-icon" aria-hidden="true"><Settings2 /></span><strong>Platform control</strong></button></div>}
      <div className="sidebar-footer"><div className="sidebar-account"><button className={accountPage ? 'sidebar-account-trigger selected' : 'sidebar-account-trigger'} aria-label="Open Profile and Security" aria-current={accountPage ? 'page' : undefined} onClick={() => navigate('/profile')}><span className="sidebar-account-avatar">{(account.data?.full_name || account.data?.email || 'U').slice(0, 2).toUpperCase()}</span><span className="sidebar-account-copy"><strong>{account.data?.full_name || 'Your account'}</strong><small>{account.data?.email}</small></span></button></div><button className="sidebar-signout icon-button" onClick={() => setConfirmLogout(true)} disabled={accountActions?.busy}><LogOut aria-hidden="true" />Logout</button></div>
    </aside>
      <main id="main" className="controller-main"><div className="controller-content">{accountPage && account.data && accountActions ? <div className="account-settings-page"><div className="account-settings-heading"><h1>Profile &amp; Security</h1></div><AccountProfile account={account.data} /><SecurityPanel account={account.data} email={account.data.email} verified={account.data.email_verified} mfa={account.data.mfa_enabled} emailEnabled={accountActions.emailEnabled} mfaAvailable={accountActions.securityAvailable} refresh={identity} codes={accountActions.securityCodes} signedOut={accountActions.signedOut} changePassword={accountActions.password} /></div> : <>{workspace === 'platform' && platformAccess && <PlatformStepUpProvider>{platformSection === 'overview' ? <PlatformOverview openOrganizations={() => setPlatformSection('organizations')} /> : platformSection === 'organizations' ? <PlatformOrganizations superAdmin={platformRole === 'super_admin'} /> : platformRole === 'super_admin' ? <PlatformUsers /> : null}</PlatformStepUpProvider>}{workspace === 'organization' && organizationAccess && <OrganizationWorkspace onSetupActive={handleSetupActive} section={activeSection} setSection={setOrganizationSection} memberships={account.data?.memberships || []} />}</>}</div></main>
    </div>
    {confirmLogout && <div className="logout-backdrop" onClick={() => setConfirmLogout(false)}><section className="logout-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-title" onClick={event => event.stopPropagation()}><div className="logout-dialog-icon"><LogOut aria-hidden="true" /></div><h2 id="logout-title">Log out of Ive POS?</h2><p>You’ll need to sign in again to access your workspace.</p><div className="logout-actions"><button className="secondary-button" autoFocus onClick={() => setConfirmLogout(false)}>Stay signed in</button><button className="primary-button" disabled={accountActions?.busy} onClick={() => { setConfirmLogout(false); accountActions?.signOut() }}>Log out</button></div></section></div>}
  </div>
}

function OrganizationWorkspace({ section, setSection, memberships, onSetupActive }: { onSetupActive: (active: boolean) => void; section: OrganizationSection; setSection: (section: OrganizationSection) => void; memberships: Identity['memberships'] }) {
  const [setupDeferred, setSetupDeferred] = useState(false)
  return <AdminQuickSetup onActiveChange={onSetupActive} memberships={memberships} manual={section === 'setup'} autoEnabled={!setupDeferred} done={() => { setSetupDeferred(true); setSection('stores') }}><><h1 className="sr-only">{section === 'people' ? 'People and Access' : section === 'settings' ? 'Organization Settings' : section[0].toUpperCase() + section.slice(1)}</h1>{section === 'stores' && <StoreSetup mode="stores" openSettings={() => setSection('settings')} />}{section === 'terminal' && <Terminal memberships={memberships} />}{section === 'report' && <ReportPage memberships={memberships} />}{section === 'operations' && <Operations memberships={memberships} />}{section === 'people' && <Employees />}{section === 'settings' && <StoreSetup mode="settings" />}</></AdminQuickSetup>
}

export default App
