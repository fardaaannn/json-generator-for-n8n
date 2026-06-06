import { describe, it, expect } from 'vitest'
import { computeLayout, nodeAriaLabel, summaryAriaLabel } from './workflowLayout.js'
import { makeT } from './i18n.jsx'

const t = makeT('en')

// A simple linear workflow: Webhook -> Filter -> Slack
const linearWorkflow = {
  nodes: [
    { name: 'Webhook', type: 'n8n-nodes-base.webhook' },
    { name: 'Filter', type: 'n8n-nodes-base.filter' },
    { name: 'Slack', type: 'n8n-nodes-base.slack' },
  ],
  connections: {
    Webhook: { main: [[{ node: 'Filter', type: 'main', index: 0 }]] },
    Filter: { main: [[{ node: 'Slack', type: 'main', index: 0 }]] },
  },
}

describe('computeLayout', () => {
  it('returns null when there are no nodes', () => {
    expect(computeLayout(null)).toBeNull()
    expect(computeLayout({})).toBeNull()
    expect(computeLayout({ nodes: [] })).toBeNull()
  })

  it('builds one box per node and one edge per connection', () => {
    const layout = computeLayout(linearWorkflow)
    expect(layout.boxes).toHaveLength(3)
    expect(layout.edges).toHaveLength(2)
  })

  it('records outgoing targets on each box', () => {
    const layout = computeLayout(linearWorkflow)
    const byName = Object.fromEntries(layout.boxes.map((b) => [b.name, b]))
    expect(byName.Webhook.outputs).toEqual(['Filter'])
    expect(byName.Filter.outputs).toEqual(['Slack'])
    expect(byName.Slack.outputs).toEqual([])
  })

  it('places connected nodes in increasing columns (longest-path levelling)', () => {
    const layout = computeLayout(linearWorkflow)
    const byName = Object.fromEntries(layout.boxes.map((b) => [b.name, b]))
    expect(byName.Webhook.x).toBeLessThan(byName.Filter.x)
    expect(byName.Filter.x).toBeLessThan(byName.Slack.x)
  })

  it('does not loop forever on a cyclic graph', () => {
    const cyclic = {
      nodes: [{ name: 'A', type: 't.a' }, { name: 'B', type: 't.b' }],
      connections: {
        A: { main: [[{ node: 'B' }]] },
        B: { main: [[{ node: 'A' }]] },
      },
    }
    const layout = computeLayout(cyclic)
    expect(layout.boxes).toHaveLength(2)
    expect(layout.edges).toHaveLength(2)
  })

  it('does not throw on null/non-object node entries', () => {
    const wf = {
      nodes: [
        { name: 'Webhook', type: 'n8n-nodes-base.webhook' },
        null,
        'oops',
      ],
      connections: {
        Webhook: { main: [[{ node: 'Filter', type: 'main', index: 0 }]] },
      },
    }
    let layout
    expect(() => { layout = computeLayout(wf) }).not.toThrow()
    // One box per entry; the malformed ones get synthetic keys/labels.
    expect(layout.boxes).toHaveLength(3)
    expect(layout.boxes.find((b) => b.name === 'Webhook')).toBeTruthy()
  })
})

describe('summaryAriaLabel', () => {
  it('summarizes node and connection counts', () => {
    const layout = computeLayout(linearWorkflow)
    expect(summaryAriaLabel(layout, t)).toBe('3 nodes, 2 connections')
  })
})

describe('nodeAriaLabel', () => {
  it('describes a node and the nodes it connects to', () => {
    const layout = computeLayout(linearWorkflow)
    const webhook = layout.boxes.find((b) => b.name === 'Webhook')
    const label = nodeAriaLabel(webhook, t)
    expect(label).toContain('Node Webhook')
    expect(label).toContain('type webhook')
    expect(label).toContain('connects to Filter')
  })

  it('notes when a node has no outgoing connections', () => {
    const layout = computeLayout(linearWorkflow)
    const slack = layout.boxes.find((b) => b.name === 'Slack')
    expect(nodeAriaLabel(slack, t)).toContain('no outgoing connections')
  })
})
