import { describe, it, expect, afterEach } from 'vitest'
import {
  sanitizeInput,
  buildPrompt,
  buildRefinePrompt,
  buildRepairPrompt,
  cleanOutput,
  repairJSON,
  normalizeConnections,
  validateStructure,
  maxTokensFor,
  assertHttpUrl,
  isLocalHttpHost,
  isMaxTokensError,
  unwrapWorkflow,
  buildStructureRepairPrompt,
  importToN8n,
  EXAMPLE_JSON,
} from './pipeline.js'

describe('sanitizeInput', () => {
  it('returns an empty string for non-string input', () => {
    expect(sanitizeInput(null)).toBe('')
    expect(sanitizeInput(undefined)).toBe('')
    expect(sanitizeInput(42)).toBe('')
    expect(sanitizeInput({})).toBe('')
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeInput('   hello   ')).toBe('hello')
  })

  it('keeps tabs and newlines but strips other control characters', () => {
    const input = 'a\u0000b\u0007c\td\ne'
    expect(sanitizeInput(input)).toBe('abc\td\ne')
  })

  it('normalizes CRLF and lone CR to LF', () => {
    expect(sanitizeInput('a\r\nb\rc')).toBe('a\nb\nc')
  })

  it('collapses runs of 3 or more blank lines into a single blank line', () => {
    expect(sanitizeInput('a\n\n\n\n\nb')).toBe('a\n\nb')
  })

  it('does not cap the description length (no max characters)', () => {
    const long = 'x'.repeat(5000)
    expect(sanitizeInput(long).length).toBe(5000)
  })
})

describe('buildPrompt', () => {
  const base = {
    description: 'Send a Slack message every morning',
    name: 'Morning Ping',
    version: '1.x',
    complexity: 'medium',
    lang: 'id',
  }

  it('embeds the user description inside the delimited workflow_request block', () => {
    const prompt = buildPrompt(base)
    expect(prompt).toContain('<workflow_request>')
    expect(prompt).toContain('Send a Slack message every morning')
    expect(prompt).toContain('</workflow_request>')
  })

  it('includes the workflow name and target n8n version', () => {
    const prompt = buildPrompt(base)
    expect(prompt).toContain('"Morning Ping"')
    expect(prompt).toContain('1.x')
  })

  it('maps complexity to the matching instruction and falls back to medium', () => {
    expect(buildPrompt({ ...base, complexity: 'simple' })).toContain('node minimal')
    expect(buildPrompt({ ...base, complexity: 'complex' })).toContain('error handling')
    // Unknown complexity falls back to the medium description.
    expect(buildPrompt({ ...base, complexity: 'nonsense' })).toContain('parameter yang realistis')
  })

  it('selects the comment language label from the lang flag', () => {
    expect(buildPrompt({ ...base, lang: 'id' })).toContain('Indonesia')
    expect(buildPrompt({ ...base, lang: 'en' })).toContain('English')
  })

  it('builds the whole prompt scaffolding in English when lang is en', () => {
    const prompt = buildPrompt({ ...base, lang: 'en' })
    expect(prompt).toContain('You are an expert n8n workflow builder')
    expect(prompt).toContain('OUTPUT FORMAT:')
    expect(prompt).toContain('Build a complete workflow') // medium, English
    // and not the Indonesian scaffolding
    expect(prompt).not.toContain('Kamu adalah expert')
  })

  it('does not suggest any node-count limit to the model', () => {
    // No "At most N nodes" / "Maksimal N nodes" guidance — the model decides.
    expect(buildPrompt({ ...base, complexity: 'complex' })).not.toMatch(/\d+\s*nodes/i)
    expect(buildPrompt({ ...base, complexity: 'complex', lang: 'en' })).not.toContain('At most')
    expect(buildPrompt({ ...base, complexity: 'complex' })).not.toContain('Maksimal')
  })
})

describe('maxTokensFor', () => {
  it('grows the token budget with complexity', () => {
    expect(maxTokensFor('simple')).toBe(4000)
    expect(maxTokensFor('medium')).toBe(8000)
    expect(maxTokensFor('complex')).toBe(32000)
  })

  it('falls back to the medium budget for unknown complexity', () => {
    expect(maxTokensFor('nonsense')).toBe(8000)
    expect(maxTokensFor(undefined)).toBe(8000)
  })
})

describe('few-shot example', () => {
  it('exposes a valid, parseable example workflow', () => {
    const wf = JSON.parse(EXAMPLE_JSON)
    expect(Array.isArray(wf.nodes)).toBe(true)
    expect(wf.nodes.length).toBeGreaterThan(0)
    // The example must itself pass structural validation (no warnings) so we
    // never teach the model a broken shape.
    expect(validateStructure(wf)).toEqual([])
  })

  it('embeds the example in the generated prompt as a format reference', () => {
    const idPrompt = buildPrompt({ description: 'x', name: 'n', version: '1.x', complexity: 'medium', lang: 'id' })
    const enPrompt = buildPrompt({ description: 'x', name: 'n', version: '1.x', complexity: 'medium', lang: 'en' })
    expect(idPrompt).toContain('CONTOH')
    expect(enPrompt).toContain('EXAMPLE')
    expect(idPrompt).toContain(EXAMPLE_JSON)
    expect(enPrompt).toContain(EXAMPLE_JSON)
  })
})

describe('buildRepairPrompt', () => {
  const args = {
    currentJSON: '{"name":"X","nodes":[]}',
    warnings: ['A connection references a target node that does not exist: Ghost'],
    version: '1.x',
    lang: 'en',
  }

  it('includes the workflow and the concrete issues to fix', () => {
    const prompt = buildRepairPrompt(args)
    expect(prompt).toContain('<workflow>')
    expect(prompt).toContain('{"name":"X","nodes":[]}')
    expect(prompt).toContain('does not exist: Ghost')
    expect(prompt).toContain('ISSUES TO FIX:')
  })

  it('builds the Indonesian variant when lang is id', () => {
    const prompt = buildRepairPrompt({ ...args, lang: 'id' })
    expect(prompt).toContain('MASALAH YANG HARUS DIPERBAIKI:')
    expect(prompt).not.toContain('ISSUES TO FIX:')
  })

  it('tolerates a missing/empty warnings list', () => {
    expect(() => buildRepairPrompt({ ...args, warnings: undefined })).not.toThrow()
  })
})

describe('buildRefinePrompt', () => {
  it('delimits the current workflow and the instruction as data blocks', () => {
    const prompt = buildRefinePrompt({
      currentJSON: '{"name":"X"}',
      instruction: 'add an IF node',
      version: '1.x',
      lang: 'en',
    })
    expect(prompt).toContain('<current_workflow>')
    expect(prompt).toContain('{"name":"X"}')
    expect(prompt).toContain('<instruction>')
    expect(prompt).toContain('add an IF node')
    expect(prompt).toContain('English')
  })
})

describe('cleanOutput', () => {
  it('returns an empty string for non-string input', () => {
    expect(cleanOutput(null)).toBe('')
    expect(cleanOutput(123)).toBe('')
  })

  it('strips markdown code fences', () => {
    const raw = '```json\n{"a":1}\n```'
    expect(cleanOutput(raw)).toBe('{"a":1}')
  })

  it('extracts the JSON object from surrounding prose', () => {
    const raw = 'Sure! Here is your workflow:\n{"name":"wf"}\nHope it helps.'
    expect(cleanOutput(raw)).toBe('{"name":"wf"}')
  })

  it('keeps content from the first brace to the last brace', () => {
    const raw = 'noise {"a":{"b":1}} trailing'
    expect(cleanOutput(raw)).toBe('{"a":{"b":1}}')
  })
})

describe('repairJSON', () => {
  it('parses valid JSON without marking it repaired', () => {
    const { value, repaired } = repairJSON('{"name":"wf","nodes":[]}')
    expect(repaired).toBe(false)
    expect(value).toEqual({ name: 'wf', nodes: [] })
  })

  it('balances missing closing brackets on truncated output', () => {
    const truncated = '{"name":"wf","nodes":[{"id":"1","type":"x"}'
    const { value, repaired } = repairJSON(truncated)
    expect(repaired).toBe(true)
    expect(value.name).toBe('wf')
    expect(value.nodes).toHaveLength(1)
    expect(value.nodes[0].id).toBe('1')
  })

  it('throws a translated error when there is no closing brace', () => {
    expect(() => repairJSON('this is not json')).toThrow('errJsonInvalid')
  })

  it('throws when the content cannot be repaired into valid JSON', () => {
    expect(() => repairJSON('{"a": }')).toThrow('errJsonInvalid')
  })

  it('ignores brackets inside string values when balancing', () => {
    // A Code node's jsCode commonly contains braces; a naive bracket count
    // would append the wrong number of closers here.
    const truncated = '{"name":"wf","nodes":[{"id":"1","parameters":{"jsCode":"if (x) { return [1,2]; }"}}'
    const { value, repaired } = repairJSON(truncated)
    expect(repaired).toBe(true)
    expect(value.nodes).toHaveLength(1)
    expect(value.nodes[0].parameters.jsCode).toBe('if (x) { return [1,2]; }')
  })

  it('ignores escaped quotes inside strings when balancing', () => {
    const truncated = '{"name":"a \\"quoted\\" {value}","nodes":[{"id":"1"}'
    const { value, repaired } = repairJSON(truncated)
    expect(repaired).toBe(true)
    expect(value.nodes[0].id).toBe('1')
  })

  it('closes brackets in the right (innermost-first) order', () => {
    const truncated = '{"a":{"b":[{"c":1}'
    const { value, repaired } = repairJSON(truncated)
    expect(repaired).toBe(true)
    expect(value).toEqual({ a: { b: [{ c: 1 }] } })
  })
})

describe('assertHttpUrl', () => {
  it('accepts https URLs for any host', () => {
    expect(assertHttpUrl('https://api.example.com/v1').hostname).toBe('api.example.com')
  })

  it('accepts http URLs for local and private hosts', () => {
    expect(assertHttpUrl('http://localhost:5678').hostname).toBe('localhost')
    expect(assertHttpUrl('http://127.0.0.1:5678').hostname).toBe('127.0.0.1')
    expect(assertHttpUrl('http://192.168.1.10:5678').hostname).toBe('192.168.1.10')
    expect(assertHttpUrl('http://10.0.0.5').hostname).toBe('10.0.0.5')
    expect(assertHttpUrl('http://172.16.0.1').hostname).toBe('172.16.0.1')
    expect(assertHttpUrl('http://n8n.local').hostname).toBe('n8n.local')
    expect(assertHttpUrl('http://[::1]:5678').hostname).toBe('[::1]')
    // bare intranet hostname
    expect(assertHttpUrl('http://nas:5678').hostname).toBe('nas')
  })

  it('rejects http URLs for public hosts (API key would travel unencrypted)', () => {
    expect(() => assertHttpUrl('http://api.example.com')).toThrow('errHttpRemote')
    expect(() => assertHttpUrl('http://172.32.0.1')).toThrow('errHttpRemote') // outside 172.16/12
  })

  it('rejects non-http(s) schemes and unparseable input', () => {
    expect(() => assertHttpUrl('javascript:alert(1)')).toThrow('errBaseUrlInvalid')
    expect(() => assertHttpUrl('file:///etc/passwd')).toThrow('errBaseUrlInvalid')
    expect(() => assertHttpUrl('not a url')).toThrow('errBaseUrlInvalid')
  })
})

describe('isLocalHttpHost', () => {
  it('classifies hosts correctly', () => {
    expect(isLocalHttpHost('localhost')).toBe(true)
    expect(isLocalHttpHost('127.0.0.1')).toBe(true)
    expect(isLocalHttpHost('[::1]')).toBe(true)
    expect(isLocalHttpHost('192.168.0.2')).toBe(true)
    expect(isLocalHttpHost('example.com')).toBe(false)
    expect(isLocalHttpHost('8.8.8.8')).toBe(false)
    expect(isLocalHttpHost('')).toBe(false)
  })
})

describe('isMaxTokensError', () => {
  it('matches provider wordings for an over-limit max_tokens', () => {
    // OpenAI
    expect(isMaxTokensError(new Error('max_tokens is too large: 100000. This model supports at most 16384 completion tokens. (400)'))).toBe(true)
    // Anthropic
    expect(isMaxTokensError(new Error('max_tokens: 100000 > 64000, which is the maximum allowed number of output tokens for this model (400)'))).toBe(true)
    // Groq-style
    expect(isMaxTokensError(new Error('max_tokens must be less than or equal to 32768 (400)'))).toBe(true)
  })

  it('does not match unrelated errors', () => {
    expect(isMaxTokensError(new Error('Invalid API key (401)'))).toBe(false)
    expect(isMaxTokensError(new Error('rate limit exceeded, tokens per minute (429)'))).toBe(false)
    expect(isMaxTokensError(new Error('errTimeout'))).toBe(false)
  })
})

describe('validateStructure', () => {
  const validWorkflow = {
    name: 'My Workflow',
    nodes: [
      { id: '1', name: 'Webhook', type: 'n8n-nodes-base.webhook', position: [0, 0], parameters: {} },
      { id: '2', name: 'HTTP', type: 'n8n-nodes-base.httpRequest', position: [200, 0], parameters: {} },
    ],
    connections: {
      Webhook: { main: [[{ node: 'HTTP', type: 'main', index: 0 }]] },
    },
  }

  it('returns no warnings for a well-formed workflow', () => {
    expect(validateStructure(validWorkflow)).toEqual([])
  })

  it('warns when the name is not a string', () => {
    const wf = { ...validWorkflow, name: 123 }
    expect(validateStructure(wf)).toContain('warnName')
  })

  it('warns when nodes is not an array', () => {
    const wf = { ...validWorkflow, nodes: 'oops' }
    expect(validateStructure(wf)).toContain('warnNodesArray')
  })

  it('warns about a node missing an id', () => {
    const wf = {
      ...validWorkflow,
      nodes: [{ name: 'NoId', type: 'n8n-nodes-base.webhook', position: [0, 0], parameters: {} }],
      connections: {},
    }
    expect(validateStructure(wf)).toContain('warnNodeNoId')
  })

  it('warns about duplicate node ids', () => {
    const wf = {
      ...validWorkflow,
      nodes: [
        { id: 'dup', name: 'A', type: 'n8n-nodes-base.webhook', position: [0, 0], parameters: {} },
        { id: 'dup', name: 'B', type: 'n8n-nodes-base.httpRequest', position: [1, 1], parameters: {} },
      ],
      connections: {},
    }
    expect(validateStructure(wf)).toContain('warnDupId')
  })

  it('warns about duplicate node names', () => {
    const wf = {
      ...validWorkflow,
      nodes: [
        { id: '1', name: 'Same', type: 'n8n-nodes-base.webhook', position: [0, 0], parameters: {} },
        { id: '2', name: 'Same', type: 'n8n-nodes-base.httpRequest', position: [1, 1], parameters: {} },
      ],
      connections: {},
    }
    expect(validateStructure(wf)).toContain('warnDupName')
  })

  it('does not throw and flags null/non-object node entries instead', () => {
    const wf = {
      ...validWorkflow,
      nodes: [
        { id: '1', name: 'Real', type: 'n8n-nodes-base.webhook', position: [0, 0], parameters: {} },
        null,
        'oops',
      ],
      connections: {},
    }
    let warnings
    expect(() => { warnings = validateStructure(wf) }).not.toThrow()
    // Two malformed entries (null and a string) → two warnings.
    expect(warnings.filter((w) => w === 'warnNodeNotObject')).toHaveLength(2)
    // The valid node is still processed normally (no missing-field warnings).
    expect(warnings).not.toContain('warnNodeNoId')
  })

  it('warns about a malformed node type with no namespace dot', () => {
    const wf = {
      ...validWorkflow,
      nodes: [{ id: '1', name: 'Bad', type: 'webhook', position: [0, 0], parameters: {} }],
      connections: {},
    }
    expect(validateStructure(wf)).toContain('warnNodeTypeFormat')
  })

  it('warns about a likely-hallucinated base node type', () => {
    const wf = {
      ...validWorkflow,
      nodes: [{ id: '1', name: 'Fake', type: 'n8n-nodes-base.notARealNode', position: [0, 0], parameters: {} }],
      connections: {},
    }
    expect(validateStructure(wf)).toContain('warnNodeTypeUnknown')
  })

  it('warns about missing position and parameters', () => {
    const wf = {
      ...validWorkflow,
      nodes: [{ id: '1', name: 'Sparse', type: 'n8n-nodes-base.webhook' }],
      connections: {},
    }
    const warnings = validateStructure(wf)
    expect(warnings).toContain('warnNodeNoPos')
    expect(warnings).toContain('warnNodeNoParams')
  })

  it('warns when connections is missing or not a plain object', () => {
    expect(validateStructure({ ...validWorkflow, connections: undefined })).toContain('warnConnections')
    expect(validateStructure({ ...validWorkflow, connections: [] })).toContain('warnConnections')
  })

  it('warns when a connection references an unknown source node', () => {
    const wf = {
      ...validWorkflow,
      connections: { Ghost: { main: [[{ node: 'HTTP', type: 'main', index: 0 }]] } },
    }
    expect(validateStructure(wf)).toContain('warnConnUnknownSource')
  })

  it('warns when a connection references an unknown target node', () => {
    const wf = {
      ...validWorkflow,
      connections: { Webhook: { main: [[{ node: 'Nowhere', type: 'main', index: 0 }]] } },
    }
    expect(validateStructure(wf)).toContain('warnConnUnknownTarget')
  })

  it('flags a non-trigger node that has no incoming or outgoing connection', () => {
    const wf = {
      name: 'wf',
      nodes: [
        { id: '1', name: 'Webhook', type: 'n8n-nodes-base.webhook', position: [0, 0], parameters: {} },
        { id: '2', name: 'HTTP', type: 'n8n-nodes-base.httpRequest', position: [200, 0], parameters: {} },
        { id: '3', name: 'Lonely', type: 'n8n-nodes-base.set', position: [400, 0], parameters: {} },
      ],
      connections: { Webhook: { main: [[{ node: 'HTTP', type: 'main', index: 0 }]] } },
    }
    expect(validateStructure(wf)).toContain('warnOrphanNode')
  })

  it('does not flag a trigger node for having no incoming connection', () => {
    // Webhook is a trigger; it has an outgoing edge but the test guards that a
    // trigger sitting at the start is never reported as orphan.
    expect(validateStructure(validWorkflow)).not.toContain('warnOrphanNode')
  })

  it('does not flag orphans when the workflow has no connections at all', () => {
    const wf = {
      name: 'wf',
      nodes: [
        { id: '1', name: 'A', type: 'n8n-nodes-base.set', position: [0, 0], parameters: {} },
        { id: '2', name: 'B', type: 'n8n-nodes-base.set', position: [200, 0], parameters: {} },
      ],
      connections: {},
    }
    expect(validateStructure(wf)).not.toContain('warnOrphanNode')
  })
})


describe('normalizeConnections', () => {
  // Mirrors the real-world bug: connections keyed/targeted by node id instead
  // of node name, which leaves the preview/import with no links.
  const idBasedWorkflow = () => ({
    nodes: [
      { id: 'schedule-1', name: 'Jadwal Harian', type: 'n8n-nodes-base.scheduleTrigger' },
      { id: 'http-1', name: 'Ambil Data', type: 'n8n-nodes-base.httpRequest' },
      { id: 'set-1', name: 'Ekstrak Field', type: 'n8n-nodes-base.set' },
    ],
    connections: {
      'schedule-1': { main: [[{ node: 'http-1', index: 0 }]] },
      'http-1': { main: [[{ node: 'set-1', index: 0 }]] },
    },
  })

  it('rewrites id-based source keys to node names', () => {
    const wf = normalizeConnections(idBasedWorkflow())
    expect(Object.keys(wf.connections).sort()).toEqual(['Ambil Data', 'Jadwal Harian'])
    expect(wf.connections['schedule-1']).toBeUndefined()
  })

  it('rewrites id-based target references to node names', () => {
    const wf = normalizeConnections(idBasedWorkflow())
    expect(wf.connections['Jadwal Harian'].main[0][0].node).toBe('Ambil Data')
    expect(wf.connections['Ambil Data'].main[0][0].node).toBe('Ekstrak Field')
  })

  it('makes an id-based workflow pass connection validation', () => {
    const wf = normalizeConnections(idBasedWorkflow())
    const warnings = validateStructure(wf)
    expect(warnings).not.toContain('warnConnUnknownSource')
    expect(warnings).not.toContain('warnConnUnknownTarget')
  })

  it('leaves already name-based connections untouched', () => {
    const wf = {
      nodes: [
        { id: '1', name: 'Webhook', type: 'n8n-nodes-base.webhook' },
        { id: '2', name: 'HTTP', type: 'n8n-nodes-base.httpRequest' },
      ],
      connections: { Webhook: { main: [[{ node: 'HTTP', type: 'main', index: 0 }]] } },
    }
    const out = normalizeConnections(wf)
    expect(out.connections.Webhook.main[0][0].node).toBe('HTTP')
    expect(out.connections.HTTP).toBeUndefined()
  })

  it('preserves the connection type field and extra props on targets', () => {
    const wf = {
      nodes: [
        { id: 'a', name: 'A', type: 'n8n-nodes-base.if' },
        { id: 'b', name: 'B', type: 'n8n-nodes-base.noOp' },
      ],
      connections: { a: { main: [[{ node: 'b', type: 'main', index: 0 }]] } },
    }
    const out = normalizeConnections(wf)
    expect(out.connections.A.main[0][0]).toEqual({ node: 'B', type: 'main', index: 0 })
  })

  it('is robust to missing/empty/malformed connections', () => {
    expect(normalizeConnections(null)).toBeNull()
    expect(normalizeConnections({}).connections).toBeUndefined()
    const arrConns = { nodes: [], connections: [] }
    expect(normalizeConnections(arrConns).connections).toEqual([])
  })

  it('leaves references that match neither a name nor an id untouched', () => {
    const wf = {
      nodes: [{ id: '1', name: 'Real', type: 'n8n-nodes-base.set' }],
      connections: { Real: { main: [[{ node: 'Ghost', type: 'main', index: 0 }]] } },
    }
    const out = normalizeConnections(wf)
    expect(out.connections.Real.main[0][0].node).toBe('Ghost')
  })
})


describe('importToN8n', () => {
  const wf = { name: 'My WF', nodes: [{ id: '1' }], connections: {}, settings: {} }
  const args = { baseUrl: 'https://n8n.example.com', apiKey: 'k', workflow: wf }

  function stubFetch(impl) {
    const calls = []
    globalThis.fetch = async (url, opts) => {
      calls.push({ url, opts })
      return impl(url, opts)
    }
    return calls
  }

  const jsonResponse = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })

  afterEach(() => {
    delete globalThis.fetch
  })

  it('POSTs a new workflow when no workflowId is given', async () => {
    const calls = stubFetch(() => jsonResponse(200, { id: 'abc123' }))
    const res = await importToN8n(args)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://n8n.example.com/api/v1/workflows')
    expect(calls[0].opts.method).toBe('POST')
    expect(calls[0].opts.headers['X-N8N-API-KEY']).toBe('k')
    // payload is sanitized to the strict create/update schema
    expect(Object.keys(JSON.parse(calls[0].opts.body)).sort()).toEqual(['connections', 'name', 'nodes', 'settings'])
    expect(res).toEqual({ id: 'abc123', updated: false, raw: { id: 'abc123' } })
  })

  it('PUTs to the existing workflow when workflowId is given', async () => {
    const calls = stubFetch(() => jsonResponse(200, { id: 'abc123' }))
    const res = await importToN8n({ ...args, workflowId: 'abc123' })
    expect(calls[0].url).toBe('https://n8n.example.com/api/v1/workflows/abc123')
    expect(calls[0].opts.method).toBe('PUT')
    expect(res.updated).toBe(true)
    expect(res.id).toBe('abc123')
  })

  it('URL-encodes the workflow id', async () => {
    const calls = stubFetch(() => jsonResponse(200, {}))
    await importToN8n({ ...args, workflowId: 'a/b c' })
    expect(calls[0].url).toBe('https://n8n.example.com/api/v1/workflows/a%2Fb%20c')
  })

  it('falls back to the given id when the update response has none', async () => {
    stubFetch(() => jsonResponse(200, {}))
    const res = await importToN8n({ ...args, workflowId: 'xyz' })
    expect(res.id).toBe('xyz')
  })

  it('reports a deleted linked workflow as errN8nGone (update only)', async () => {
    stubFetch(() => jsonResponse(404, { message: 'not found' }))
    await expect(importToN8n({ ...args, workflowId: 'gone' })).rejects.toThrow('errN8nGone')
    // a plain create 404 is a generic failure, not "gone"
    stubFetch(() => jsonResponse(404, { message: 'not found' }))
    await expect(importToN8n(args)).rejects.toThrow('errN8nFailed')
  })

  it('maps auth and validation errors as before', async () => {
    stubFetch(() => jsonResponse(401, {}))
    await expect(importToN8n(args)).rejects.toThrow('errN8nAuth')
    stubFetch(() => jsonResponse(400, { message: 'bad node' }))
    await expect(importToN8n({ ...args, workflowId: 'id1' })).rejects.toThrow('errN8nBadRequest')
  })
})


describe('unwrapWorkflow', () => {
  const wf = { name: 'WF', nodes: [{ id: '1', type: 'n8n-nodes-base.webhook' }], connections: {} }

  it('returns a proper workflow unchanged (same reference)', () => {
    expect(unwrapWorkflow(wf)).toBe(wf)
  })

  it('unwraps the common wrapper keys', () => {
    for (const key of ['workflow', 'data', 'json', 'output', 'result']) {
      expect(unwrapWorkflow({ [key]: wf })).toBe(wf)
    }
  })

  it('unwraps a single-key envelope up to two levels deep', () => {
    expect(unwrapWorkflow({ response: wf })).toBe(wf)
    expect(unwrapWorkflow({ response: { payload: wf } })).toBe(wf)
    // three levels is beyond the safe-guess limit
    const deep = { a: { b: { c: wf } } }
    expect(unwrapWorkflow(deep)).toBe(deep)
  })

  it('wraps a bare nodes array into a workflow', () => {
    const nodes = [
      { id: '1', name: 'Webhook', type: 'n8n-nodes-base.webhook' },
      { id: '2', name: 'Slack', type: 'n8n-nodes-base.slack' },
    ]
    const out = unwrapWorkflow(nodes)
    expect(out.nodes).toBe(nodes)
    expect(out.connections).toEqual({})
    expect(typeof out.name).toBe('string')
  })

  it('takes the workflow out of a one-element array', () => {
    expect(unwrapWorkflow([wf])).toBe(wf)
  })

  it('leaves non-workflow shapes alone', () => {
    const notWf = { foo: 1, bar: 2 }
    expect(unwrapWorkflow(notWf)).toBe(notWf)
    const arr = [1, 2, 3]
    expect(unwrapWorkflow(arr)).toBe(arr)
    expect(unwrapWorkflow(null)).toBe(null)
    expect(unwrapWorkflow('x')).toBe('x')
  })
})

describe('repairJSON parse-error tagging', () => {
  it('marks unrecoverable parse failures with isJsonInvalid', () => {
    try {
      repairJSON('this is not json at all')
      expect.unreachable('should have thrown')
    } catch (e) {
      expect(e.message).toBe('errJsonInvalid')
      expect(e.isJsonInvalid).toBe(true)
    }
  })
})

describe('buildStructureRepairPrompt', () => {
  it('embeds the raw output and the schema rules (both languages)', () => {
    const en = buildStructureRepairPrompt({ rawText: 'oops {bad', version: '1.x', lang: 'en' })
    expect(en).toContain('oops {bad')
    expect(en).toContain('name, nodes, connections, active, settings')
    expect(en).toContain('1.x')
    const id = buildStructureRepairPrompt({ rawText: 'oops {bad', version: '1.x', lang: 'id' })
    expect(id).toContain('oops {bad')
    expect(id).toContain('tanpa objek pembungkus')
  })

  it('caps pathological raw output length', () => {
    const big = 'x'.repeat(200000)
    const p = buildStructureRepairPrompt({ rawText: big, version: '1.x', lang: 'en' })
    expect(p.length).toBeLessThan(70000)
  })
})
