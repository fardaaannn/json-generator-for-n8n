import { describe, it, expect } from 'vitest'
import { diffWorkflows } from './workflowDiff.js'

const baseWorkflow = {
  name: 'WF',
  nodes: [
    { name: 'Webhook', type: 'n8n-nodes-base.webhook', parameters: { path: 'a' }, position: [0, 0] },
    { name: 'Filter', type: 'n8n-nodes-base.filter', parameters: { value: 1 }, position: [100, 0] },
  ],
  connections: {
    Webhook: { main: [[{ node: 'Filter', type: 'main', index: 0 }]] },
  },
}

describe('diffWorkflows', () => {
  it('reports no changes for an identical workflow', () => {
    const diff = diffWorkflows(baseWorkflow, JSON.parse(JSON.stringify(baseWorkflow)))
    expect(diff.hasChanges).toBe(false)
    expect(diff.changeCount).toBe(0)
  })

  it('detects an added node and its new connection', () => {
    const after = JSON.parse(JSON.stringify(baseWorkflow))
    after.nodes.push({ name: 'Slack', type: 'n8n-nodes-base.slack', parameters: {}, position: [200, 0] })
    after.connections.Filter = { main: [[{ node: 'Slack', type: 'main', index: 0 }]] }

    const diff = diffWorkflows(baseWorkflow, after)
    expect(diff.addedNodes).toEqual(['Slack'])
    expect(diff.removedNodes).toEqual([])
    expect(diff.addedConnections).toEqual([{ from: 'Filter', to: 'Slack' }])
    expect(diff.hasChanges).toBe(true)
  })

  it('detects a removed node and its dropped connection', () => {
    const after = { ...baseWorkflow, nodes: [baseWorkflow.nodes[0]], connections: {} }
    const diff = diffWorkflows(baseWorkflow, after)
    expect(diff.removedNodes).toEqual(['Filter'])
    expect(diff.removedConnections).toEqual([{ from: 'Webhook', to: 'Filter' }])
  })

  it('detects a node whose parameters changed', () => {
    const after = JSON.parse(JSON.stringify(baseWorkflow))
    after.nodes[1].parameters = { value: 2 }
    const diff = diffWorkflows(baseWorkflow, after)
    expect(diff.modifiedNodes).toEqual(['Filter'])
    expect(diff.addedNodes).toEqual([])
    expect(diff.removedNodes).toEqual([])
  })

  it('ignores position-only changes (layout noise)', () => {
    const after = JSON.parse(JSON.stringify(baseWorkflow))
    after.nodes[0].position = [500, 500]
    after.nodes[1].position = [600, 600]
    const diff = diffWorkflows(baseWorkflow, after)
    expect(diff.hasChanges).toBe(false)
    expect(diff.modifiedNodes).toEqual([])
  })

  it('is robust to missing/empty inputs', () => {
    expect(diffWorkflows(null, null).hasChanges).toBe(false)
    const diff = diffWorkflows(undefined, baseWorkflow)
    expect(diff.addedNodes.sort()).toEqual(['Filter', 'Webhook'])
    expect(diff.addedConnections).toEqual([{ from: 'Webhook', to: 'Filter' }])
  })
})
