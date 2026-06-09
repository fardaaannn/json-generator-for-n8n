import { describe, it, expect } from 'vitest'
import {
  encodeWorkflow,
  decodeWorkflow,
  buildShareUrl,
  readShareParam,
} from './shareLink.js'

const sampleWorkflow = JSON.stringify({
  name: 'Daily Slack Ping',
  nodes: [
    { id: 'a1', name: 'Jadwal Harian', type: 'n8n-nodes-base.scheduleTrigger', position: [240, 300], parameters: {} },
    { id: 'b2', name: 'Kirim Slack', type: 'n8n-nodes-base.slack', position: [460, 300], parameters: { channel: '#notif' } },
  ],
  connections: { 'Jadwal Harian': { main: [[{ node: 'Kirim Slack', type: 'main', index: 0 }]] } },
  active: false,
  settings: {},
  id: 'wf-1',
})

describe('encodeWorkflow / decodeWorkflow round-trip', () => {
  it('decodes back to the exact original JSON string', async () => {
    const token = await encodeWorkflow(sampleWorkflow)
    expect(token).toBeTruthy()
    const decoded = await decodeWorkflow(token)
    expect(decoded).toBe(sampleWorkflow)
  })

  it('produces a URL-safe token (no +, /, = characters)', async () => {
    const token = await encodeWorkflow(sampleWorkflow)
    expect(token).not.toMatch(/[+/=]/)
  })

  it('round-trips a large workflow intact', async () => {
    const big = JSON.stringify({
      name: 'big',
      nodes: Array.from({ length: 200 }, (_, i) => ({
        id: 'n' + i, name: 'Node ' + i, type: 'n8n-nodes-base.set', position: [i * 10, 0], parameters: { value: 'x'.repeat(50) },
      })),
      connections: {},
    })
    const token = await encodeWorkflow(big)
    expect(await decodeWorkflow(token)).toBe(big)
  })

  it('returns empty string for invalid encode input', async () => {
    expect(await encodeWorkflow('')).toBe('')
    expect(await encodeWorkflow(null)).toBe('')
    expect(await encodeWorkflow(42)).toBe('')
  })
})

describe('decodeWorkflow fail-soft', () => {
  it('returns null for malformed / non-token input rather than throwing', async () => {
    expect(await decodeWorkflow('')).toBeNull()
    expect(await decodeWorkflow(null)).toBeNull()
    expect(await decodeWorkflow('x')).toBeNull()
    // valid-looking but corrupt gzip payload under the 'g' codec
    expect(await decodeWorkflow('g!!!!notbase64!!!!')).toBeNull()
    // unknown codec marker
    expect(await decodeWorkflow('zSGVsbG8')).toBeNull()
  })
})

describe('buildShareUrl', () => {
  it('builds origin + pathname + #w=token', () => {
    const url = buildShareUrl('gABC', { origin: 'https://x.github.io', pathname: '/json-generator-for-n8n/' })
    expect(url).toBe('https://x.github.io/json-generator-for-n8n/#w=gABC')
  })
})

describe('readShareParam', () => {
  it('extracts the token from a share hash', () => {
    expect(readShareParam('#w=gABC123')).toBe('gABC123')
  })

  it('returns null for a non-share hash or empty token', () => {
    expect(readShareParam('')).toBeNull()
    expect(readShareParam('#theme=dark')).toBeNull()
    expect(readShareParam('#w=')).toBeNull()
    expect(readShareParam(null)).toBeNull()
  })

  it('round-trips through buildShareUrl + readShareParam', async () => {
    const token = await encodeWorkflow(sampleWorkflow)
    const url = buildShareUrl(token, { origin: 'https://x.io', pathname: '/app/' })
    const hash = '#' + url.split('#')[1]
    expect(readShareParam(hash)).toBe(token)
  })
})
