import { describe, it, expect } from 'vitest'
import { findSecrets, describeFindings } from './secretScan.js'

const wrap = (params) =>
  JSON.stringify({
    name: 'wf',
    nodes: [{ id: 'a', name: 'N', type: 'n8n-nodes-base.httpRequest', position: [0, 0], parameters: params }],
    connections: {},
  })

describe('findSecrets — known token shapes', () => {
  it('detects an OpenAI-style key', () => {
    const res = findSecrets(wrap({ headers: { Authorization: 'sk-proj-abc123def456ghi789jkl012' } }))
    expect(res.length).toBeGreaterThan(0)
    expect(res.some((f) => f.kind.includes('OpenAI'))).toBe(true)
  })

  it('detects an Anthropic key', () => {
    const res = findSecrets(wrap({ key: 'sk-ant-api03-AbCdEfGhIjKlMnOp' }))
    expect(res.some((f) => f.kind.includes('Anthropic'))).toBe(true)
  })

  it('detects GitHub classic and fine-grained tokens', () => {
    expect(findSecrets(wrap({ token: 'ghp_AbCdEfGhIjKlMnOpQrSt123456' })).length).toBeGreaterThan(0)
    expect(findSecrets(wrap({ token: 'github_pat_AbCdEfGhIjKlMnOpQrSt_123456' })).length).toBeGreaterThan(0)
  })

  it('detects Slack, AWS, Google, Stripe, OpenRouter tokens', () => {
    expect(findSecrets(wrap({ t: 'xoxb-1234567890-abcdefghij' })).length).toBeGreaterThan(0)
    expect(findSecrets(wrap({ t: 'AKIAIOSFODNN7EXAMPLE' })).length).toBeGreaterThan(0)
    expect(findSecrets(wrap({ t: 'AIzaSyA1bC2dE3fG4hI5jK6lM7nO8pQ9rS0tU1v' })).length).toBeGreaterThan(0)
    expect(findSecrets(wrap({ t: 'sk_live_AbCdEfGhIjKlMnOpQrSt' })).length).toBeGreaterThan(0)
    expect(findSecrets(wrap({ t: 'sk-or-v1-abcdef1234567890abcdef' })).length).toBeGreaterThan(0)
  })

  it('detects JWTs, private key blocks and Bearer tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpM'
    expect(findSecrets(wrap({ t: jwt })).some((f) => f.kind === 'JWT')).toBe(true)
    expect(findSecrets(wrap({ pem: '-----BEGIN RSA PRIVATE KEY-----\\nMIIE...' })).length).toBeGreaterThan(0)
    expect(findSecrets(wrap({ h: 'Bearer abcdefghijklmnopqrstuvwxyz123456' })).length).toBeGreaterThan(0)
  })

  it('redacts values in previews (never echoes the full secret)', () => {
    const secret = 'ghp_AbCdEfGhIjKlMnOpQrSt123456'
    const res = findSecrets(wrap({ token: secret }))
    for (const f of res) expect(f.preview).not.toBe(secret)
    expect(res[0].preview).toContain('…')
  })

  it('deduplicates the same value appearing twice', () => {
    const json = wrap({ a: 'ghp_AbCdEfGhIjKlMnOpQrSt123456', b: 'ghp_AbCdEfGhIjKlMnOpQrSt123456' })
    const res = findSecrets(json)
    expect(res.length).toBe(1)
  })
})

describe('findSecrets — secret-named fields with opaque values', () => {
  it('flags an apiKey field holding a long opaque value', () => {
    const res = findSecrets(wrap({ apiKey: 'd41d8cd98f00b204e9800998ecf8427e' }))
    expect(res.length).toBe(1)
    expect(res[0].kind).toContain('apiKey')
  })

  it('flags password/credential-named fields', () => {
    expect(findSecrets(wrap({ db_password: 'Sup3rS3cretValue99' })).length).toBe(1)
    expect(findSecrets(wrap({ authToken: 'abcdef0123456789abcdef' })).length).toBe(1)
  })
})

describe('findSecrets — no false positives on normal workflows', () => {
  it('ignores ordinary parameters and prose mentioning keys', () => {
    const res = findSecrets(
      wrap({
        url: 'https://api.example.com/data',
        method: 'GET',
        description: 'uses the api key from credential settings',
      })
    )
    expect(res).toEqual([])
  })

  it('ignores n8n credential expressions and placeholders', () => {
    expect(findSecrets(wrap({ apiKey: '={{ $credentials.openAiApi.apiKey }}' }))).toEqual([])
    expect(findSecrets(wrap({ apiKey: '{{ $env.MY_KEY_FROM_ENVIRONMENT }}' }))).toEqual([])
    expect(findSecrets(wrap({ apiKey: 'YOUR_API_KEY_GOES_HERE' }))).toEqual([])
    expect(findSecrets(wrap({ apiKey: '<your-api-key-here>' }))).toEqual([])
  })

  it('ignores short values even under secret-ish names', () => {
    expect(findSecrets(wrap({ token: 'abc123' }))).toEqual([])
  })

  it('handles empty / non-string input', () => {
    expect(findSecrets('')).toEqual([])
    expect(findSecrets(null)).toEqual([])
    expect(findSecrets(undefined)).toEqual([])
  })
})

describe('describeFindings', () => {
  it('joins kinds with redacted previews', () => {
    const res = findSecrets(wrap({ token: 'ghp_AbCdEfGhIjKlMnOpQrSt123456' }))
    const text = describeFindings(res)
    expect(text).toContain('GitHub token')
    expect(text).toContain('…')
  })
})
