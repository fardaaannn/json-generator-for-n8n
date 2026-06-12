import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/json-generator-for-n8n/',
  test: {
    // Unit tests only — the e2e/ folder belongs to Playwright (bun run test:e2e).
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
