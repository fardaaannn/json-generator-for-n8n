import { describe, it, expect } from 'vitest'
import { validateNodeParams } from './nodeSchemas'
import { validateStructure } from './pipeline'

// Mirrors the fallbackT used across the lib tests: t(key, params) returns the
// key itself, so assertions can match on stable keys instead of copy.
const t = (key) => key

const node = (type, parameters = {}, extra = {}) => ({
  id: 'x1', name: 'Test Node', type: 'n8n-nodes-base.' + type, position: [0, 0], parameters, ...extra,
})

describe('validateNodeParams', () => {
  it('returns no warnings for a fully valid node', () => {
    expect(validateNodeParams(node('httpRequest', { url: 'https://x.test', method: 'GET' }), t)).toEqual([])
    expect(validateNodeParams(node('webhook', { path: 'hook', httpMethod: 'POST' }), t)).toEqual([])
  })

  it('flags a missing required parameter', () => {
    expect(validateNodeParams(node('httpRequest', { method: 'GET' }), t)).toContain('warnParamMissing')
    expect(validateNodeParams(node('webhook', {}), t)).toContain('warnParamMissing')
  })

  it('treats empty strings and null as missing', () => {
    expect(validateNodeParams(node('httpRequest', { url: '' }), t)).toContain('warnParamMissing')
    expect(validateNodeParams(node('webhook', { path: null }), t)).toContain('warnParamMissing')
  })

  it('accepts any one of the requiredAny alternatives for code nodes', () => {
    expect(validateNodeParams(node('code', { jsCode: 'return items' }), t)).toEqual([])
    expect(validateNodeParams(node('code', { language: 'python', pythonCode: 'return items' }), t)).toEqual([])
    expect(validateNodeParams(node('code', { language: 'javaScript' }), t)).toContain('warnParamMissing')
  })

  it('flags unknown parameters on strict (core) node types', () => {
    expect(validateNodeParams(node('webhook', { path: 'hook', responseTemplate: 'x' }), t)).toContain('warnParamUnknown')
    expect(validateNodeParams(node('noOp', { mode: 'simple' }), t)).toContain('warnParamUnknown')
  })

  it('does not flag unknown parameters on non-strict app nodes', () => {
    const w = validateNodeParams(node('slack', { resource: 'message', operation: 'post', weirdExtra: true }), t)
    expect(w).toEqual([])
  })

  it('flags invalid enum values but allows expressions', () => {
    expect(validateNodeParams(node('httpRequest', { url: 'https://x.test', method: 'FETCH' }), t)).toContain('warnParamEnum')
    expect(validateNodeParams(node('httpRequest', { url: 'https://x.test', method: '={{ $json.m }}' }), t)).toEqual([])
  })

  it('flags an implausibly high typeVersion', () => {
    expect(validateNodeParams(node('webhook', { path: 'hook' }, { typeVersion: 9 }), t)).toContain('warnTypeVersionHigh')
    expect(validateNodeParams(node('webhook', { path: 'hook' }, { typeVersion: 2 }), t)).toEqual([])
  })

  it('ignores node types without a schema', () => {
    expect(validateNodeParams(node('notion', { madeUp: 1 }), t)).toEqual([])
    expect(validateNodeParams({ type: 'custom-pkg.thing', parameters: { x: 1 } }, t)).toEqual([])
  })

  it('handles a malformed parameters value without throwing', () => {
    expect(validateNodeParams(node('webhook', 'oops'), t)).toContain('warnParamMissing')
  })
})

describe('validateStructure integration', () => {
  it('surfaces parameter warnings through the structural validator', () => {
    const wf = {
      name: 'Wf',
      nodes: [
        { id: '1', name: 'Hook', type: 'n8n-nodes-base.webhook', position: [0, 0], parameters: { paht: 'typo' } },
      ],
      connections: {},
    }
    const warnings = validateStructure(wf)
    expect(warnings).toContain('warnParamMissing')
    expect(warnings).toContain('warnParamUnknown')
  })

  it('stays silent for a workflow with valid parameters', () => {
    const wf = {
      name: 'Wf',
      nodes: [
        { id: '1', name: 'Cron', type: 'n8n-nodes-base.scheduleTrigger', position: [0, 0], parameters: { rule: { interval: [] } } },
        { id: '2', name: 'Call', type: 'n8n-nodes-base.httpRequest', position: [200, 0], parameters: { url: 'https://x.test' } },
      ],
      connections: { Cron: { main: [[{ node: 'Call', type: 'main', index: 0 }]] } },
    }
    expect(validateStructure(wf)).toEqual([])
  })
})
