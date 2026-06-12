import { describe, it, expect } from 'vitest'
import {
  encodeWorkflow,
  decodeWorkflow,
  decodeShare,
  buildShareUrl,
  readShareParam,
  MAX_DECODED_BYTES,
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


// --- helpers to fabricate tokens for version tests ---

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('share link format versioning', () => {
  it('new tokens carry a version prefix and round-trip via decodeShare', async () => {
    const token = await encodeWorkflow(sampleWorkflow)
    expect(token[0]).toBe('1')
    const res = await decodeShare(token)
    expect(res).toEqual({ json: sampleWorkflow, version: 1, error: null })
  })

  it('still decodes legacy (unversioned) tokens', async () => {
    // legacy format: '<codec r><base64url(workflow json)>', no envelope
    const legacy = 'r' + toBase64Url(sampleWorkflow)
    expect(await decodeWorkflow(legacy)).toBe(sampleWorkflow)
    const res = await decodeShare(legacy)
    expect(res.version).toBe(0)
    expect(res.json).toBe(sampleWorkflow)
    expect(res.error).toBeNull()
  })

  it('extracts the workflow from a FUTURE version that honors the `w` contract', async () => {
    const envelope = JSON.stringify({ v: 7, newField: { whatever: true }, w: sampleWorkflow })
    const future = '7r' + toBase64Url(envelope)
    const res = await decodeShare(future)
    expect(res.version).toBe(7)
    expect(res.json).toBe(sampleWorkflow)
    expect(res.error).toBeNull()
  })

  it('reports unsupported-version when a future token has no usable workflow', async () => {
    const future = '9r' + toBase64Url(JSON.stringify({ v: 9, blob: 'opaque' }))
    const res = await decodeShare(future)
    expect(res.json).toBeNull()
    expect(res.error).toBe('unsupported-version')
  })

  it('reports corrupt for a damaged current-version token', async () => {
    const res = await decodeShare('1g!!!!notbase64!!!!')
    expect(res.json).toBeNull()
    expect(res.error).toBe('corrupt')
    // a v1 envelope missing `w` is corrupt, not unsupported
    const noW = '1r' + toBase64Url(JSON.stringify({ v: 1 }))
    expect((await decodeShare(noW)).error).toBe('corrupt')
  })

  it('accepts an envelope whose w is an object (stringifies it)', async () => {
    const wfObj = { name: 'X', nodes: [], connections: {} }
    const tok = '1r' + toBase64Url(JSON.stringify({ v: 1, w: wfObj }))
    const res = await decodeShare(tok)
    expect(JSON.parse(res.json)).toEqual(wfObj)
  })
})

describe('decompression-bomb guard', () => {
  it('exports a sane cap constant', () => {
    expect(MAX_DECODED_BYTES).toBe(5 * 1024 * 1024)
  })

  it('still round-trips normal workflows under the cap', async () => {
    const token = await encodeWorkflow(sampleWorkflow)
    expect(await decodeWorkflow(token)).toBe(sampleWorkflow)
  })

  it('rejects a gzip token that inflates past the cap (fail-soft null)', async () => {
    // ~6 MB of a single repeated character compresses to a few KB — exactly
    // the shape of a decompression bomb carried in a share link.
    const bomb = JSON.stringify({ v: 1, ts: 0, w: 'x'.repeat(6 * 1024 * 1024) })
    const cs = new CompressionStream('gzip')
    const stream = new Response(new TextEncoder().encode(bomb)).body.pipeThrough(cs)
    const gz = new Uint8Array(await new Response(stream).arrayBuffer())
    // Token is tiny even though the payload is 6 MB inflated.
    expect(gz.length).toBeLessThan(64 * 1024)
    let bin = ''
    for (let i = 0; i < gz.length; i++) bin += String.fromCharCode(gz[i])
    const token = '1g' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    expect(await decodeWorkflow(token)).toBeNull()
    const res = await decodeShare(token)
    expect(res.json).toBeNull()
    expect(res.error).toBe('corrupt')
  })

  it('rejects an oversized raw (uncompressed) token too', async () => {
    // raw payload above the cap -> corrupt, app never JSON.parses it
    const big = 'y'.repeat(MAX_DECODED_BYTES + 1024)
    const res = await decodeShare('1r' + toBase64Url(big))
    expect(res.json).toBeNull()
    expect(res.error).toBe('corrupt')
  })
})
