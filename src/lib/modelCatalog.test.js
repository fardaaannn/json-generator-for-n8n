import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchModels } from './modelCatalog.js'

// These tests focus on the security guard added to fetchModels: the request
// URL (derived from a user-supplied base URL for the Custom provider, with the
// API key attached as a Bearer token) must be validated as an http(s) URL
// BEFORE any network request is made, so the credential can never be sent to a
// non-network scheme. Runs in the default (node) environment: `fetch` is a
// global we spy on, and localStorage is absent so the cache layer no-ops via
// its try/catch guards — exactly the "no cached fallback" path we want to test.

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchModels — URL scheme guard', () => {
  it('does NOT fetch and returns null for a non-http(s) custom base URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    // javascript: scheme → buildModelsRequest yields "javascript:...//models",
    // which assertHttpUrl must reject before the key is ever attached/sent.
    const result = await fetchModels('custom', {
      apiKey: 'sk-secret',
      baseUrl: 'javascript:alert(1)',
    })
    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does NOT fetch for a data: scheme custom base URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const result = await fetchModels('custom', {
      apiKey: 'sk-secret',
      baseUrl: 'data:text/html,evil',
    })
    expect(result).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('proceeds to fetch for a valid https custom base URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'model-a' }, { id: 'model-b' }] }),
    })
    const result = await fetchModels('custom', {
      apiKey: 'sk-secret',
      baseUrl: 'https://api.example.com/v1',
      force: true,
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    // The validated URL is the one actually requested.
    expect(fetchSpy.mock.calls[0][0]).toBe('https://api.example.com/v1/models')
    expect(result).toContain('model-a')
    expect(result).toContain('model-b')
  })

  it('proceeds to fetch for the http localhost case (n8n / local gateways)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: 'local-model' }] }),
    })
    const result = await fetchModels('custom', {
      apiKey: '',
      baseUrl: 'http://localhost:1234/v1',
      force: true,
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(result).toEqual(['local-model'])
  })
})
