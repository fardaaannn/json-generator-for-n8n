import { defineConfig } from '@playwright/test'

// E2E smoke tests against the production build served by `vite preview`.
// Run with: bun run test:e2e  (first time: bunx playwright install chromium)
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  // The UI language follows navigator.language (id vs en); pin to English so
  // text assertions are deterministic regardless of the host machine locale.
  use: {
    baseURL: 'http://127.0.0.1:4173/json-generator-for-n8n/',
    locale: 'en-US',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'bun run build && bun run preview -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/json-generator-for-n8n/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
