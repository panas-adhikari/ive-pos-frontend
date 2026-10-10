import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function mock(page: Page, failure = false, tenant = true) {
  let org = { id: 'org-test', name: 'Margret Crimson', organization_type: 'retail', image_url: '', location_label: 'Kathmandu, Nepal', configured: true, store_limit: 3, employee_limit: 15, contact_email: 'owner@example.com', phone: '+977 9800000000', website_url: '', currency: 'NPR', timezone: 'Asia/Kathmandu', receipt_footer: 'Thank you for visiting!', version: 7, slug: 'crimson', subdomain_enabled: tenant }
  const writes: { path: string; body: Record<string, unknown> }[] = []
  const account = { id: 'owner', email: 'owner@example.com', full_name: 'Owner', phone: '', job_title: '', platform_role: 'none', session_id: 'session', email_verified: true, must_change_password: false, mfa_enabled: true, require_action_verification: false, step_up_expires: '2099-01-01T00:00:00Z', memberships: [{ organization_id: org.id, name: org.name, image_url: '', organization_type: 'retail', permissions: ['organization.setup'], roles: ['owner'], all_stores: true, store_ids: [] }] }
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/me')) return route.fulfill({ json: account })
    if (path.endsWith('/auth/capabilities')) return route.fulfill({ json: { email: true, mfa: true } })
    if (path.endsWith('/public/site')) return route.fulfill({ json: { organization: null, platform_url: 'http://app.localhost:18091', tenant_base_domain: 'localhost' } })
    if (path.endsWith('/ready')) return route.fulfill({ json: { status: 'ready' } })
    if (path.endsWith('/setup')) return route.fulfill({ json: { organization: org, stores: [{ id: 'store', code: 'MAIN', name: 'Main store', active: true, registers: [{ id: 'register', code: 'COUNTER', name: 'Counter', active: true }] }], currencies: ['NPR', 'USD'], timezones: ['Asia/Kathmandu', 'UTC'] } })
    if (path.endsWith('/settings')) {
      const body = route.request().postDataJSON(); writes.push({ path, body })
      if (failure) return route.fulfill({ status: 409, json: { detail: 'Organization changed. Reload before saving.' } })
      org = { ...org, ...body, version: org.version + 1 }; return route.fulfill({ json: org })
    }
    if (path.endsWith('/store-limit-requests')) { writes.push({ path, body: route.request().postDataJSON() }); return route.fulfill({ json: { status: 'requested' } }) }
    return route.fulfill({ status: 500, json: { detail: `Unexpected request: ${path}` } })
  })
  return writes
}
for (const width of [1440, 768, 390]) {
  test(`settings edits, previews and capacity at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
    const writes = await mock(page)
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Organization settings', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open sign-in' })).toHaveAttribute('href', 'http://crimson.localhost:18091/login')
    await expect(page.getByRole('button', { name: 'Save settings', exact: true })).toBeDisabled()
    await page.getByLabel('Business name', { exact: true }).fill('Margret Crimson Retail')
    await expect(page.locator('.org-settings-receipt')).toContainText('Margret Crimson Retail')
    await page.getByRole('button', { name: 'Discard', exact: true }).click()
    await expect(page.getByLabel('Business name', { exact: true })).toHaveValue('Margret Crimson')
    await page.getByRole('textbox', { name: 'Receipt footer', exact: true }).fill('Visit again!')
    await page.getByRole('combobox', { name: 'Currency', exact: true }).selectOption('USD')
    await expect(page.locator('.org-settings-receipt')).toContainText('$100.00')
    await page.getByRole('button', { name: 'Save settings', exact: true }).click()
    await expect(page.getByText('Organization settings saved.', { exact: true })).toBeVisible()
    expect(writes[0].body).toMatchObject({ expected_version: 7, receipt_footer: 'Visit again!', currency: 'USD' })
    await page.getByLabel('Business phone', { exact: true }).fill('+977 9811111111')
    await page.getByRole('button', { name: 'Save settings', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Save settings', exact: true })).toBeDisabled()
    expect(writes[1].body.expected_version).toBe(8)
    await page.getByRole('button', { name: 'Request more stores', exact: true }).click()
    await page.getByLabel('Requested total stores').fill('5')
    await page.getByLabel('Reason for request').fill('Opening two new locations this year.')
    await page.getByRole('button', { name: 'Send request', exact: true }).click()
    await expect(page.getByText('Request sent to the platform team for review.')).toBeVisible()
    expect(writes[2].body).toMatchObject({ requested_limit: 5 })
    await page.getByRole('heading', { name: 'Organization settings', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`settings-${width}.png`), fullPage: true })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await page.locator('.org-settings').evaluate(root => root.scrollWidth <= root.clientWidth + 1)).toBe(true)
    expect(await page.locator('.org-settings-layout').evaluate(root => root.scrollWidth <= root.clientWidth + 1)).toBe(true)
    await page.getByRole('heading', { name: 'Sign-in address', exact: true }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath(`settings-access-${width}.png`) })
    expect(await page.locator('.org-settings').evaluate(root => [...root.querySelectorAll('input,select,textarea')].every(input => (input as HTMLInputElement).labels?.length))).toBe(true)
    expect(errors).toEqual([])
  })
}
test('failed saves retain edits; explicit reload restores saved values', async ({ page }) => {
  await mock(page, true, false); await page.goto('/settings')
  await expect(page.getByRole('link', { name: 'Open sign-in' })).toHaveAttribute('href', 'http://app.localhost:18091/login')
  await page.getByLabel('Business name', { exact: true }).fill('Unsaved business name')
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Organization changed')
  await expect(page.getByLabel('Business name', { exact: true })).toHaveValue('Unsaved business name')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Reload saved settings' }).click()
  await expect(page.getByLabel('Business name', { exact: true })).toHaveValue('Margret Crimson')
})

test('unsaved edits protect workspace navigation and broken logos use initials', async ({ page }) => {
  await mock(page)
  await page.route('https://images.example.com/logo.png', route => route.fulfill({ status: 404, body: '' }))
  await page.goto('/settings')
  await page.getByLabel('Logo URL', { exact: true }).fill('https://images.example.com/logo.png')
  await expect(page.getByLabel('Organization initials')).toBeVisible()
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'Profile & security' }).click()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByLabel('Logo URL', { exact: true })).toHaveValue('https://images.example.com/logo.png')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Stores & registers', exact: true }).click()
  await expect(page).toHaveURL(/\/stores$/)
})

test('invalid contact email is rejected before a save request', async ({ page }) => {
  const writes = await mock(page); await page.goto('/settings')
  await page.getByLabel('Business contact email', { exact: true }).fill('invalid-email')
  await page.getByRole('button', { name: 'Save settings', exact: true }).click()
  expect(writes).toHaveLength(0)
  expect(await page.getByLabel('Business contact email', { exact: true }).evaluate(input => (input as HTMLInputElement).validity.valid)).toBe(false)
})
