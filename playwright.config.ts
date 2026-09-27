import { defineConfig } from '@playwright/test'

// Local test traffic must not be routed through an environment's outbound proxy.
process.env.NO_PROXY = 'localhost,127.0.0.1'
process.env.no_proxy = process.env.NO_PROXY
process.env.npm_config_no_proxy = process.env.NO_PROXY

const database = process.env.AUTH_TEST_DATABASE_URL
if (!database || !new URL(database).pathname.endsWith('_test')) {
  throw new Error('AUTH_TEST_DATABASE_URL must point to a dedicated migrated _test database')
}

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:18081', browserName: 'chromium' },
  webServer: [
    {
      command: 'venv/bin/python -m tests.seed_e2e && venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 18080 --no-proxy-headers',
      cwd: '../backend',
      env: {
        DATABASE_URL: database, AUTH_TEST_DATABASE_URL: database,
        AUTH_SECRET: 'browser-test-only-secret-at-least-32-characters',
        APP_ENV: 'development', PUBLIC_ORIGIN: 'http://127.0.0.1:18081',
        IDENTITY_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
        EMAIL_PROVIDER: 'smtp', BREVO_API_KEY: '',
        SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_STARTTLS: 'false',
      },
      wait: { stderr: /Uvicorn running on/ },
      timeout: 20_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 18081 --strictPort',
      env: { POS_API_TARGET: 'http://127.0.0.1:18080' },
      wait: { stdout: /Local:/ },
      timeout: 20_000,
    },
  ],
})
