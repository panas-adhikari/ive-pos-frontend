import { defineConfig } from '@playwright/test'
process.env.NO_PROXY = 'localhost,127.0.0.1'
process.env.no_proxy = process.env.NO_PROXY
export default defineConfig({
  testDir: './e2e-session', workers: 1,
  use: { baseURL: 'http://127.0.0.1:18091', browserName: 'chromium' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 18091 --strictPort', wait: { stdout: /Local:/ }, timeout: 20000 },
})
