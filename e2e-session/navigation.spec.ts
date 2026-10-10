import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const admin = { id: 'admin', email: 'admin@example.com', full_name: 'Platform Admin', phone: '', job_title: '', platform_role: 'super_admin', session_id: 'session', email_verified: true, must_change_password: false, mfa_enabled: true, require_action_verification: false, step_up_expires: '2099-01-01T00:00:00Z', memberships: [] }
const organization = { id: 'org-test', name: 'Atharva Organization', slug: null, subdomain_enabled: false, login_url: 'http://app.localhost:18091/login', organization_type: 'retail', image_url: '', location_label: '', configured: true, store_limit: 2, employee_limit: 10, active_employees: 1, deletion_scheduled_for: null, billing_plan: null, billing_amount_minor: null, billing_currency: null, billing_interval: null, contact_email: '', phone: '', owner_name: '', owner_phone: '', owner_title: '', website_url: '', latitude: null, longitude: null, currency: 'NPR', timezone: 'Asia/Kathmandu', stores: 1, version: 1, store_limit_requests: [] }
type MockAccount = Omit<typeof admin, 'memberships'> & { memberships: { organization_id: string; name: string; image_url: string; organization_type: string; permissions: string[]; roles: string[]; all_stores: boolean; store_ids: string[] }[] }
async function mockApi(page: Page, options: { loggedIn?: boolean; refresh?: boolean; account?: MockAccount } = {}) {
  let loggedIn = options.loggedIn ?? true
  const account = options.account ?? admin
  const calls: string[] = []
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    calls.push(path)
    if (path.endsWith('/auth/me')) return route.fulfill({ status: loggedIn ? 200 : 401, json: loggedIn ? account : {} })
    if (path.endsWith('/auth/refresh')) { if (options.refresh) loggedIn = true; return route.fulfill({ status: loggedIn ? 200 : 401, json: {} }) }
    if (path.endsWith('/auth/login')) { loggedIn = true; return route.fulfill({ json: {} }) }
    if (path.endsWith('/auth/logout')) { loggedIn = false; return route.fulfill({ json: {} }) }
    if (path.endsWith('/auth/capabilities')) return route.fulfill({ json: { email: true, mfa: true } })
    if (path.endsWith('/public/site')) return route.fulfill({ json: { organization: new URL(route.request().url()).hostname === 'atharva.localhost' ? { ...organization, slug: 'atharva' } : null, platform_url: 'http://app.localhost:18091', tenant_base_domain: 'localhost' } })
    if (path.endsWith('/ready')) return route.fulfill({ json: { status: 'ready' } })
    if (path.endsWith('/platform/organizations')) return route.fulfill({ json: [organization] })
    if (path.endsWith('/organizations/org-test')) return route.fulfill({ json: organization })
    if (path.endsWith('/subdomain-options')) return route.fulfill({ json: { domain: 'localhost', suggestions: [] } })
    if (path.endsWith('/billing')) return route.fulfill({ json: { payments: [], recorded_totals: [] } })
    if (path.endsWith('/platform/staff')) return route.fulfill({ json: [] })
    if (path.endsWith('/org-test/setup')) return route.fulfill({ json: { organization: { ...organization, configured: false, receipt_footer: '' }, stores: [], currencies: ['NPR'], timezones: ['Asia/Kathmandu'] } })
    if (path.endsWith('/context')) return route.fulfill({ json: { organization: 'org-test', currency: 'NPR', stores: [] } })
    return route.fulfill({ status: 500, json: { detail: `Unexpected request: ${path}` } })
  })
  return calls
}

for (const width of [1440, 390]) {
  test(`active session, history, deep links and logout at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const calls = await mockApi(page)
    await page.goto('/login')
    await expect(page).toHaveURL(/\/overview$/)
    await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
    expect(calls).not.toContain('/api/v1/auth/login')
    await page.getByRole('button', { name: 'View organizations', exact: true }).click()
    await expect(page).toHaveURL(/\/organizations$/)
    await page.getByRole('button', { name: 'View Atharva Organization', exact: true }).click()
    await expect(page).toHaveURL(/\/organizations\/org-test$/)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Atharva Organization', exact: true })).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(/\/organizations$/)
    await expect(page.getByRole('heading', { name: 'Organizations', exact: true })).toBeVisible()
    await page.goForward()
    await expect(page.getByRole('heading', { name: 'Atharva Organization', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath(`navigation-${width}.png`) })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await page.locator('.controller-shell').evaluate(root => [...root.querySelectorAll('input')].every(input => input.labels?.length || input.hasAttribute('aria-label')) && [...root.querySelectorAll('img')].every(image => image.hasAttribute('alt')))).toBe(true)
    await page.getByRole('button', { name: 'Platform users', exact: true }).click()
    await expect(page).toHaveURL(/\/platform\/users$/)
    await page.goBack()
    await expect(page).toHaveURL(/\/organizations\/org-test$/)
    await page.getByRole('button', { name: 'Open Profile and Security' }).click()
    await expect(page).toHaveURL(/\/profile$/)
    await page.getByRole('button', { name: 'Logout', exact: true }).click()
    await page.getByRole('button', { name: 'Log out', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByLabel('Administrator email')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('signed-out deep link resumes after successful login', async ({ page }) => {
  await mockApi(page, { loggedIn: false })
  await page.goto('/organizations/org-test')
  await expect(page).toHaveURL(/\/login\?next=%2Forganizations%2Forg-test$/)
  await page.locator('input[name="email"]').fill('admin@example.com')
  await page.locator('input[name="password"]').fill('valid test password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL(/\/organizations\/org-test$/)
  await expect(page.getByRole('heading', { name: 'Atharva Organization', exact: true })).toBeVisible()
})

test('expired access cookie uses valid refresh session without showing login', async ({ page }) => {
  const calls = await mockApi(page, { loggedIn: false, refresh: true })
  await page.goto('/login')
  await expect(page).toHaveURL(/\/overview$/)
  expect(calls).toContain('/api/v1/auth/refresh')
  expect(calls).not.toContain('/api/v1/auth/login')
})

test('platform alias and app-host root open the active workspace', async ({ page }) => {
  await mockApi(page)
  await page.goto('/platform')
  await expect(page).toHaveURL(/\/overview$/)
  await page.goto('http://app.localhost:18091/')
  await expect(page).toHaveURL(/\/overview$/)
})

test('role restrictions and external return destinations are enforced', async ({ page }) => {
  await mockApi(page, { account: { ...admin, platform_role: 'employee' } })
  await page.goto('/platform/users')
  await expect(page).toHaveURL(/\/overview$/)
  await page.goto('/organizations/new')
  await expect(page).toHaveURL(/\/overview$/)
  await page.goto('/login?next=https%3A%2F%2Fexample.com')
  await expect(page).toHaveURL(/\/overview$/)
})

test('organization session uses its allowed routes on its tenant host', async ({ page }) => {
  await mockApi(page, { account: { ...admin, platform_role: 'none', memberships: [{ organization_id: 'org-test', name: 'Atharva Organization', image_url: '', organization_type: 'retail', permissions: ['reports.read'], roles: [], all_stores: false, store_ids: [] }] } })
  await page.goto('http://atharva.localhost:18091/login')
  await expect(page).toHaveURL(/atharva\.localhost:18091\/inventory$/)
  await page.getByRole('button', { name: 'Reports', exact: true }).click()
  await expect(page).toHaveURL(/\/reports$/)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Reports', exact: true })).toHaveAttribute('aria-current', 'page')
  await page.goto('http://atharva.localhost:18091/organizations')
  await expect(page).toHaveURL(/\/inventory$/)
})

test('required password change still blocks workspace entry', async ({ page }) => {
  await mockApi(page, { account: { ...admin, must_change_password: true } })
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Set your password', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View organizations', exact: true })).toHaveCount(0)
})

test('automatic setup has its own URL and can be deferred', async ({ page }) => {
  await mockApi(page, { account: { ...admin, platform_role: 'none', memberships: [{ organization_id: 'org-test', name: 'Atharva Organization', image_url: '', organization_type: 'retail', permissions: ['organization.setup'], roles: [], all_stores: true, store_ids: [] }] } })
  await page.goto('/login')
  await expect(page).toHaveURL(/\/setup$/)
  await expect(page.getByRole('heading', { name: 'Let’s set up your workspace' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue later', exact: true }).click()
  await expect(page).toHaveURL(/\/stores$/)
  await expect(page.getByRole('heading', { name: 'Stores & registers', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Organization settings', exact: true }).click()
  await expect(page).toHaveURL(/\/settings$/)
})

test('accounts with platform and organization roles can switch workspaces', async ({ page }) => {
  await mockApi(page, { account: { ...admin, memberships: [{ organization_id: 'org-test', name: 'Atharva Organization', image_url: '', organization_type: 'retail', permissions: ['reports.read'], roles: [], all_stores: false, store_ids: [] }] } })
  await page.goto('/overview')
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Business workspace', exact: true }).click()
  await expect(page).toHaveURL(/\/inventory$/)
  await page.getByRole('button', { name: 'Platform control', exact: true }).click()
  await expect(page).toHaveURL(/\/overview$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/inventory$/)
})
