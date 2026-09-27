import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'

function capturedLink(email: string, purpose: string) {
  return execFileSync('venv/bin/python', ['-m', 'tests.email_e2e', email, purpose], {
    cwd: '../backend', encoding: 'utf8', env: {
      ...process.env, DATABASE_URL: process.env.AUTH_TEST_DATABASE_URL,
      AUTH_SECRET: 'browser-test-only-secret-at-least-32-characters',
      APP_ENV: 'development', PUBLIC_ORIGIN: 'http://127.0.0.1:18081',
      IDENTITY_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      SMTP_HOST: '127.0.0.1', SMTP_STARTTLS: 'false',
    },
  }).trim()
}

function otp(secret: string) {
  return execFileSync('../backend/venv/bin/python', ['-c',
    'import pyotp,sys; print(pyotp.TOTP(sys.stdin.read().strip()).now())'],
    { input: secret, encoding: 'utf8' }).trim()
}

test('verified signup, MFA, backup codes, recovery and MFA removal', async ({ page }) => {
  const email = `browser-${Date.now()}@example.com`
  const password = 'browser onboarding testing passphrase'
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  await page.goto('/')
  await page.getByRole('button', { name: 'Create an account' }).click()
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(page.getByRole('status')).toContainText('If this address is eligible')
  await page.goto(capturedLink(email, 'signup'))
  await expect(page.getByLabel('Business name')).toBeVisible()
  expect(page.url()).not.toContain('token=')
  await page.getByLabel('Business name').fill('Browser onboarding shop')
  await page.getByLabel('New password', { exact: true }).fill(password)
  await page.getByLabel('Confirm new password').fill(password)
  await page.getByRole('button', { name: 'Complete request' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Account security' }).click()
  await expect(page.getByText('Email: verified · MFA: not enabled')).toBeVisible()
  await page.getByLabel('Current password').fill(password)
  await page.getByRole('button', { name: 'Set up authenticator' }).click()
  const secret = await page.locator('.setup-key').innerText()
  await page.getByLabel('Authenticator or backup code').fill(otp(secret))
  await page.getByRole('button', { name: 'Confirm authenticator' }).click()
  await expect(page.getByRole('heading', { name: 'Save your backup codes' })).toBeVisible()
  const codes = (await page.locator('.backup-codes').innerText()).split('\n')
  expect(codes).toHaveLength(10)
  await page.getByRole('button', { name: 'I saved my codes' }).click()
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('authentication code')
  await page.getByLabel('Authenticator or backup code').fill(codes[0])
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(page.getByRole('status')).toContainText('If this address is eligible')
  await page.goto(capturedLink(email, 'reset'))
  await page.getByLabel('New password', { exact: true }).fill(password + ' reset')
  await page.getByLabel('Confirm new password').fill(password + ' reset')
  await page.getByLabel('Authenticator or backup code').fill(codes[1])
  await page.getByRole('button', { name: 'Complete request' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password + ' reset')
  await page.getByLabel('Authenticator or backup code').fill(codes[2])
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Account security' }).click()
  await expect(page.getByText('Email: verified · MFA: enabled')).toBeVisible()
  await page.getByLabel('Current password').fill(password + ' reset')
  await page.getByRole('region', { name: 'Account security', exact: true }).getByLabel('Authenticator or backup code').fill(codes[3])
  await page.getByRole('button', { name: 'Disable MFA and sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
  expect(await page.evaluate(() => ({ ...localStorage, ...sessionStorage }))).toEqual({})
  await page.setViewportSize({ width: 375, height: 812 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  expect(failures).toEqual([])
})
