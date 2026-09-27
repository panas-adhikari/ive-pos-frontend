import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'

function capturedLink(email: string) {
  return execFileSync('venv/bin/python', ['-m', 'tests.email_e2e', email, 'invite'], {
    cwd: '../backend', encoding: 'utf8', env: {
      ...process.env, DATABASE_URL: process.env.AUTH_TEST_DATABASE_URL,
      AUTH_SECRET: 'browser-test-only-secret-at-least-32-characters',
      APP_ENV: 'development', PUBLIC_ORIGIN: 'http://127.0.0.1:18081',
      IDENTITY_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      SMTP_HOST: '127.0.0.1', SMTP_STARTTLS: 'false',
    },
  }).trim()
}

test('platform admin invites an owner into the created organization', async ({ page, browser }) => {
  const email = `owner-${Date.now()}@example.com`
  const name = `Invited business ${Date.now()}`
  await page.goto('/')
  await page.getByLabel('Email address').fill('platform-browser@example.com')
  await page.getByLabel('Password', { exact: true }).fill('browser platform passphrase only')
  await page.getByLabel('Authenticator or backup code').fill('00000000000000000001')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Organizations', exact: true })).toBeVisible()
  await page.getByLabel('Password', { exact: true }).fill('browser platform passphrase only')
  await page.getByLabel('Authenticator or backup code').fill('00000000000000000002')
  await page.getByRole('button', { name: 'Unlock changes', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Changes unlocked')
  await page.getByRole('button', { name: 'Invite organization', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Invite organization', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'All organizations' })).not.toBeVisible()
  await page.getByRole('button', { name: 'Organizations', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'All organizations' })).toBeVisible()
  await page.getByRole('button', { name: 'Invite organization', exact: true }).click()
  await page.getByLabel('Organization name').fill(name)
  await page.getByLabel('Owner email').fill(email)
  await page.getByLabel('Phone number').fill('9800000000')
  await expect(page.getByLabel('Timezone')).toHaveValue('Asia/Kathmandu')
  await page.getByLabel('Timezone').selectOption('Asia/Kolkata')
  await page.getByRole('button', { name: 'Send invitation', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Organizations', exact: true })).toBeVisible()
  await expect(page.getByRole('status')).toContainText(`Invitation sent to ${email}.`)
  const context = await browser.newContext()
  const owner = await context.newPage()
  await owner.goto(capturedLink(email))
  await expect(owner.getByText(name, { exact: true })).toBeVisible()
  await owner.getByLabel('New password', { exact: true }).fill('new owner onboarding password')
  await owner.getByLabel('Confirm password', { exact: true }).fill('new owner onboarding password')
  await owner.getByRole('button', { name: 'Accept invitation' }).click()
  await owner.getByLabel('Email address').fill(email)
  await owner.getByLabel('Password', { exact: true }).fill('new owner onboarding password')
  await owner.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(owner.getByRole('heading', { name: 'Complete organization setup' })).toBeVisible()
  await expect(owner.getByLabel('Onboarding organization')).toContainText(name)
  await expect(owner.getByRole('button', { name: 'Platform control', exact: false })).not.toBeVisible()
  await context.close()
})

test('organization admin invites new staff, who accepts and signs in', async ({ page, browser }) => {
  const email = `staff-${Date.now()}@example.com`
  const password = 'staff invitation testing password'
  await page.goto('/')
  await page.getByLabel('Email address').fill('setup-browser@example.com')
  await page.getByLabel('Password', { exact: true }).fill('browser setup passphrase only')
  await page.getByLabel('Authenticator or backup code').fill('00000000000000000005')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'People & access', exact: true }).click()
  await page.getByRole('button', { name: 'Manage employees', exact: true }).click()
  await page.getByLabel('Employee organization').selectOption({ label: 'Setup first business' })
  await page.getByLabel('Password for employee changes').fill('browser setup passphrase only')
  await page.getByLabel('Employee changes authentication code').fill('00000000000000000006')
  await page.getByRole('button', { name: 'Unlock employee changes' }).click()
  await page.getByRole('button', { name: 'Add employee', exact: true }).click()
  await page.getByLabel('Employee email').fill(email)
  await page.getByRole('button', { name: 'Send staff invitation' }).click()
  await expect(page.getByText('Invitation queued for email delivery.')).toBeVisible()
  const context = await browser.newContext()
  const staff = await context.newPage()
  await staff.goto(capturedLink(email))
  await expect(staff.getByRole('heading', { name: 'Join your organization' })).toBeVisible()
  await staff.getByLabel('New password', { exact: true }).fill(password)
  await staff.getByLabel('Confirm password', { exact: true }).fill(password)
  await staff.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(staff.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await staff.getByLabel('Email address').fill(email)
  await staff.getByLabel('Password', { exact: true }).fill(password)
  await staff.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(staff.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'People & access', exact: true }).click()
  await page.getByRole('button', { name: 'Manage employees', exact: true }).click()
  await expect(page.getByRole('article', { name: `Employee ${email}` })).toBeVisible()
  await context.close()
})
