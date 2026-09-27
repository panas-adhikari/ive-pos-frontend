import { expect, test } from '@playwright/test'
import { execFileSync } from 'node:child_process'

test('owner adds, scopes, edits and suspends an employee', async ({ page, browser }) => {
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  await page.goto('/')
  await page.getByLabel('Email address').fill('setup-browser@example.com')
  await page.getByLabel('Password', { exact: true }).fill('browser setup passphrase only')
  await page.getByLabel('Authenticator or backup code').fill('00000000000000000003')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'People & access', exact: true }).click()
  await page.getByRole('button', { name: 'Manage employees', exact: true }).click()
  const team = page.getByRole('region', { name: 'Employee access', exact: true })
  await team.getByLabel('Employee organization').selectOption({ label: 'Setup first business' })
  await expect(team.getByRole('button', { name: 'Add employee', exact: true })).toBeDisabled()
  await team.getByLabel('Password for employee changes').fill('browser setup passphrase only')
  await team.getByLabel('Employee changes authentication code').fill('00000000000000000004')
  await team.getByRole('button', { name: 'Unlock employee changes' }).click()
  await team.getByRole('button', { name: 'Add employee', exact: true }).click()
  await team.getByLabel('Employee email').fill('employee-browser@example.com')
  await team.getByRole('button', { name: 'Send staff invitation' }).click()
  await expect(team.getByText('Invitation queued for email delivery.')).toBeVisible()
  const invitation = execFileSync('venv/bin/python', ['-m', 'tests.email_e2e', 'employee-browser@example.com', 'invite'], {
    cwd: '../backend', encoding: 'utf8', env: {
      ...process.env, DATABASE_URL: process.env.AUTH_TEST_DATABASE_URL,
      AUTH_SECRET: 'browser-test-only-secret-at-least-32-characters',
      APP_ENV: 'development', PUBLIC_ORIGIN: 'http://127.0.0.1:18081',
      IDENTITY_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      SMTP_HOST: '127.0.0.1', SMTP_STARTTLS: 'false',
    },
  }).trim()
  const employee = team.getByRole('article', { name: 'Employee employee-browser@example.com' })
  const workerContext = await browser.newContext()
  const worker = await workerContext.newPage()
  await worker.goto(invitation)
  await worker.getByLabel('Account password', { exact: true }).fill('browser employee passphrase only')
  await worker.getByRole('button', { name: 'Accept invitation' }).click()
  await worker.getByLabel('Email address').fill('employee-browser@example.com')
  await worker.getByLabel('Password', { exact: true }).fill('browser employee passphrase only')
  await worker.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(worker.getByRole('button', { name: 'Manage employees', exact: true })).not.toBeVisible()
  await expect(worker.getByRole('heading', { name: 'Your organization access' })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'People & access', exact: true }).click()
  await page.getByRole('button', { name: 'Manage employees', exact: true }).click()
  await expect(employee.getByText('No assigned stores', { exact: true })).toBeVisible()
  await employee.getByRole('button', { name: 'Edit access' }).click()
  await team.getByLabel('All stores, including future stores', { exact: true }).check()
  await team.getByRole('button', { name: 'Save employee access' }).click()
  await expect(employee.getByText('All stores, including future stores')).toBeVisible()
  await employee.getByRole('button', { name: 'Edit access' }).click()
  await team.getByLabel('Membership active', { exact: true }).uncheck()
  page.once('dialog', dialog => dialog.accept())
  await team.getByRole('button', { name: 'Save employee access' }).click()
  await expect(employee.getByText('Suspended · Cashier')).toBeVisible()
  await worker.reload()
  await expect(worker.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await workerContext.close()
  await page.reload()
  await page.getByRole('button', { name: 'People & access', exact: true }).click()
  await page.getByRole('button', { name: 'Manage employees', exact: true }).click()
  await team.getByLabel('Employee organization').selectOption({ label: 'Setup first business' })
  await expect(employee.getByText('Suspended · Cashier')).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await page.screenshot({ path: 'test-results/employees-mobile.png', fullPage: true })
  expect(failures).toEqual([])
})
