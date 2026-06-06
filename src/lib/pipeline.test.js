import { describe, it, expect } from 'vitest'
import {
  sanitizeInput,
  buildPrompt,
  buildRefinePrompt,
  cleanOutput,
  repairJSON,
  validateStructure,
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

  it('caps the description at 2000 characters', () => {
    const long = 'x'.repeat(2500)
    expect(sanitizeInput(long).length).toBe(2000)
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
})
