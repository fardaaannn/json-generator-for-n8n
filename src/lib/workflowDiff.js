// Compute a human-readable diff between two n8n workflow objects, used to show
// "what changed" after a refine. Pure and framework-free so it stays easy to
// unit-test; the UI layer turns the result into a localized summary.

function nodeMap(wf) {
  const map = new Map()
  const nodes = Array.isArray(wf?.nodes) ? wf.nodes : []
  nodes.forEach((n, i) => {
    // Nodes are keyed by name (that's what connections reference); fall back to
    // id/index so unnamed nodes still get a stable key.
    const key = (n && n.name) || (n && n.id) || ('node-' + i)
    map.set(key, n)
  })
  return map
}

// A node is "modified" when its meaningful config changes. We deliberately
// ignore `position`: a refine often re-lays-out the canvas, and reporting every
// nudged coordinate as a change would drown out the edits that actually matter.
function nodeSignature(n) {
  if (!n || typeof n !== 'object') return ''
  return JSON.stringify({
    type: n.type ?? null,
    typeVersion: n.typeVersion ?? null,
    parameters: n.parameters ?? null,
    credentials: n.credentials ?? null,
  })
}

// Flatten a workflow's connections into a map of "source\u0000target" -> {from, to}
// so added/removed edges can be compared as a set, independent of ordering.
function connectionMap(wf) {
  const map = new Map()
  const conns = (wf && wf.connections && typeof wf.connections === 'object' && !Array.isArray(wf.connections))
    ? wf.connections : {}
  for (const from of Object.keys(conns)) {
    const outputs = conns[from] || {}
    if (!outputs || typeof outputs !== 'object') continue
    for (const outName of Object.keys(outputs)) {
      const groups = outputs[outName]
      if (!Array.isArray(groups)) continue
      for (const group of groups) {
        if (!Array.isArray(group)) continue
        for (const target of group) {
          const to = target && target.node
          if (to) map.set(from + '\u0000' + to, { from, to })
        }
      }
    }
  }
  return map
}

/**
 * @returns {{
 *   addedNodes: string[], removedNodes: string[], modifiedNodes: string[],
 *   addedConnections: {from: string, to: string}[],
 *   removedConnections: {from: string, to: string}[],
 *   changeCount: number, hasChanges: boolean
 * }}
 */
export function diffWorkflows(before, after) {
  const a = nodeMap(before)
  const b = nodeMap(after)

  const addedNodes = []
  const removedNodes = []
  const modifiedNodes = []

  for (const key of b.keys()) {
    if (!a.has(key)) addedNodes.push(key)
  }
  for (const key of a.keys()) {
    if (!b.has(key)) removedNodes.push(key)
    else if (nodeSignature(a.get(key)) !== nodeSignature(b.get(key))) modifiedNodes.push(key)
  }

  const ca = connectionMap(before)
  const cb = connectionMap(after)
  const addedConnections = []
  const removedConnections = []
  for (const [key, edge] of cb) {
    if (!ca.has(key)) addedConnections.push(edge)
  }
  for (const [key, edge] of ca) {
    if (!cb.has(key)) removedConnections.push(edge)
  }

  const changeCount =
    addedNodes.length + removedNodes.length + modifiedNodes.length +
    addedConnections.length + removedConnections.length

  return {
    addedNodes,
    removedNodes,
    modifiedNodes,
    addedConnections,
    removedConnections,
    changeCount,
    hasChanges: changeCount > 0,
  }
}
