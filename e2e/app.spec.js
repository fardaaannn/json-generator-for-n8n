import { test, expect } from '@playwright/test'

// E2E smoke tests for the critical user journeys. No real AI provider is ever
// called: the generate test points the app at a local "custom" endpoint and
// stubs it with page.route, so the suite runs offline and key-free.

const sampleWorkflow = {
  name: 'Daily Slack Ping',
  nodes: [
    { id: 'a1', name: 'Daily Schedule', type: 'n8n-nodes-base.scheduleTrigger', position: [240, 300], parameters: {} },
    { id: 'b2', name: 'Send Slack', type: 'n8n-nodes-base.slack', position: [460, 300], parameters: { channel: '#notif' } },
  ],
  connections: { 'Daily Schedule': { main: [[{ node: 'Send Slack', type: 'main', index: 0 }]] } },
  active: false,
  settings: {},
}

// Legacy share token ('r' codec = raw base64url, no version prefix): stays
// decodable forever per the share-link versioning contract, and is easy to
// build in Node without CompressionStream.
function legacyShareToken(obj) {
  const json = JSON.stringify(obj)
  return 'r' + Buffer.from(json, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

test('app loads with the main controls visible', async ({ page }) => {
  await page.goto('')
  await expect(page.locator('#desc')).toBeVisible()
  await expect(page.locator('#provider')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate workflow JSON' })).toBeVisible()
  // All five providers are selectable.
  const options = page.locator('#provider option')
  await expect(options).toHaveCount(5)
})

test('generate without a description shows a validation error', async ({ page }) => {
  await page.goto('')
  await page.getByRole('button', { name: 'Generate workflow JSON' }).click()
  await expect(page.getByRole('alert')).toContainText('description')
})

test('pasting workflow JSON loads it into the output panel', async ({ page }) => {
  await page.goto('')
  await page.getByRole('button', { name: /edit an existing workflow/i }).click()
  await page.locator('#importJson').fill(JSON.stringify(sampleWorkflow))
  await page.getByRole('button', { name: /load workflow/i }).click()
  await expect(page.locator('pre.output-code')).toContainText('Send Slack')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a share link loads the workflow and strips the hash', async ({ page }) => {
  await page.goto('#w=' + legacyShareToken(sampleWorkflow))
  await expect(page.locator('pre.output-code')).toContainText('Daily Schedule')
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('')
})

test('a corrupt share link surfaces a readable error', async ({ page }) => {
  await page.goto('#w=1g!!!!notatoken!!!!')
  await expect(page.getByRole('alert')).toContainText(/could not be read/i)
})

test('full generate flow against a stubbed provider', async ({ page }) => {
  // Stub the OpenAI-compatible endpoint the "custom" provider will call.
  await page.route('**/127.0.0.1:9876/**', async (route) => {
    const url = route.request().url()
    if (url.includes('/models')) {
      return route.fulfill({ json: { data: [{ id: 'test-model' }] } })
    }
    // Chat completion carrying the workflow. The app may first try streaming;
    // a non-SSE body falls back to the regular request path by design.
    return route.fulfill({
      json: { choices: [{ message: { content: JSON.stringify(sampleWorkflow) } }] },
    })
  })

  await page.goto('')
  await page.selectOption('#provider', 'custom')
  await page.locator('#baseUrl').fill('http://127.0.0.1:9876/v1')
  await page.locator('#customModel').fill('test-model')
  await page.locator('#apiKey').fill('test-key')
  await page.locator('#desc').fill('Every morning send a Slack ping')
  await page.getByRole('button', { name: 'Generate workflow JSON' }).click()

  await expect(page.locator('pre.output-code')).toContainText('Send Slack', { timeout: 15_000 })
  await expect(page.locator('.status-bar')).toContainText(/done/i)
  await expect(page.getByRole('alert')).toHaveCount(0)
})
