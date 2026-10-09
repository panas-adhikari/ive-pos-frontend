import { expect, test } from '@playwright/test'

for (const width of [1440, 390]) {
  test(`verified session and staff onboarding at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const account = { id: 'admin', email: 'admin@example.com', full_name: 'Platform Admin', phone: '', job_title: '', platform_role: 'super_admin', session_id: 'session', email_verified: true, must_change_password: false, mfa_enabled: true, require_action_verification: false, step_up_expires: new Date(Date.now() + 86400000).toISOString() as string | null, memberships: [] }
    const staff = [{ id: 'admin', email: account.email, full_name: account.full_name, job_title: '', role: 'super_admin', active: true, must_change_password: false, email_verified: true, mfa_enabled: true }]
    await page.route('**/api/v1/**', async route => {
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/auth/me')) return route.fulfill({ json: account })
      if (path.endsWith('/auth/capabilities')) return route.fulfill({ json: { email: true, mfa: true } })
      if (path.endsWith('/ready')) return route.fulfill({ json: { status: 'ready' } })
      if (path.endsWith('/platform/organizations')) return route.fulfill({ json: [] })
      if (path.endsWith('/platform/staff')) {
        if (route.request().method() === 'POST') {
          const body = route.request().postDataJSON()
          staff.push({ ...staff[0], ...body, id: 'staff', role: 'employee', must_change_password: true, email_verified: false, mfa_enabled: false })
          return route.fulfill({ status: 201, json: staff[1] })
        }
        return route.fulfill({ json: staff })
      }
      if (path.endsWith('/auth/security-preferences')) {
        account.require_action_verification = route.request().postDataJSON().require_action_verification
        account.step_up_expires = null
        return route.fulfill({ json: { require_action_verification: true } })
      }
      return route.fulfill({ status: 500, json: { detail: `Unexpected request: ${path}` } })
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'Onboard staff', exact: true }).click()
    await page.getByLabel('Full name', { exact: true }).fill('Support Staff')
    await page.getByLabel('Email address').fill('support@example.com')
    await page.getByLabel('Temporary password').fill('temporary staff test password')
    await page.locator('.platform-users-panel').screenshot({ path: testInfo.outputPath(`staff-${width}.png`) })
    await page.getByRole('button', { name: 'Create staff account' }).click()
    await expect(page.getByRole('status')).toContainText('Staff account created')
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText('support@example.com', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Open Profile and Security' }).click()
    await expect(page.getByLabel('Current password')).toHaveCount(0)
    await expect(page.getByLabel('Authenticator or backup code')).toHaveCount(0)
    await page.locator('.account-security-page').screenshot({ path: testInfo.outputPath(`security-${width}.png`) })
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Save verification preference' }).click()
    await expect(page.getByRole('status')).toContainText('Verification preference saved')
    await expect(page.getByLabel('Current password')).toHaveCount(2)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    // Basic visual/accessibility lint for the new surfaces.
    const findings = await page.locator('.account-security-page').evaluate(root => {
      const problems: string[] = []
      for (const input of root.querySelectorAll('input')) {
        if (!input.labels?.length && !input.getAttribute('aria-label')) problems.push('Unlabelled input')
      }
      for (const image of root.querySelectorAll('img')) {
        if (!image.hasAttribute('alt')) problems.push('Missing image alt')
      }
      for (const element of root.querySelectorAll('p, small, label, button')) {
        if (parseFloat(getComputedStyle(element).fontSize) < 12) problems.push('Text below 12px')
      }
      return problems
    })
    expect(findings).toEqual([])
    expect(errors).toEqual([])
  })
}
