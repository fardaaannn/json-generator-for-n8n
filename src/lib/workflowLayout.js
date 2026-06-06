import { getNodeClass } from './getNodeClass'

// Node box geometry. NODE_W / NODE_H are also needed by the renderer (to size
// the boxes and anchor the SVG edges), so they're exported.
export const NODE_W = 150
export const NODE_H = 52
const GAP_X = 56
const GAP_Y = 22
const PAD = 16

function shortType(type) {
  if (!type) return 'node'
  const parts = String(type).split('.')
  return parts[parts.length - 1] || type
}

/**
 * Lightweight, dependency-free layout for a visual n8n workflow preview.
 * Lays nodes out left-to-right in columns derived from the connection graph
 * (longest-path levelling), and returns edges as endpoint pairs the renderer
 * draws as SVG bezier curves. Falls back gracefully for isolated nodes,
 * missing names, and cyclic graphs.
 *
 * Each returned box carries an `outputs` array (names of the nodes it connects
 * to) so the renderer can build a meaningful text label for assistive tech —
 * the visual diagram itself is decorative and hidden from screen readers.
 */
export function computeLayout(workflow) {
  const nodes = Array.isArray(workflow?.nodes) ? workflow.nodes : []
  if (nodes.length === 0) return null

  // Map by name (connections key on names); keep a stable key per node.
  const keyOf = (n, i) => n.name || n.id || ('node-' + i)
  const order = nodes.map((n, i) => keyOf(n, i))
  const byKey = new Map()
  nodes.forEach((n, i) => byKey.set(keyOf(n, i), n))

  // Build adjacency (source -> [targets]) from connections.
  const adj = new Map(order.map((k) => [k, []]))
  const indeg = new Map(order.map((k) => [k, 0]))
  const conns = (workflow.connections && typeof workflow.connections === 'object' && !Array.isArray(workflow.connections))
    ? workflow.connections : {}

  for (const source of Object.keys(conns)) {
    if (!byKey.has(source)) continue
    const outputs = conns[source] || {}
    for (const outName of Object.keys(outputs)) {
      const groups = outputs[outName]
      if (!Array.isArray(groups)) continue
      for (const group of groups) {
        if (!Array.isArray(group)) continue
        for (const target of group) {
          const tName = target && target.node
          if (tName && byKey.has(tName) && tName !== source) {
            adj.get(source).push(tName)
            indeg.set(tName, (indeg.get(tName) || 0) + 1)
          }
        }
      }
    }
  }

  // Longest-path levelling (cap iterations to stay safe on cycles).
  const level = new Map(order.map((k) => [k, 0]))
  const maxIter = order.length + 1
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false
    for (const src of order) {
      const base = level.get(src)
      for (const tgt of adj.get(src)) {
        if (level.get(tgt) < base + 1) {
          level.set(tgt, base + 1)
          changed = true
        }
      }
    }
    if (!changed) break
  }

  // Group by level, assign a row index per column.
  const columns = new Map()
  for (const k of order) {
    const lv = level.get(k)
    if (!columns.has(lv)) columns.set(lv, [])
    columns.get(lv).push(k)
  }

  const pos = new Map()
  let maxRows = 0
  for (const [lv, keys] of columns) {
    keys.forEach((k, row) => {
      pos.set(k, {
        x: PAD + lv * (NODE_W + GAP_X),
        y: PAD + row * (NODE_H + GAP_Y),
      })
    })
    maxRows = Math.max(maxRows, keys.length)
  }

  const levels = Math.max(...Array.from(columns.keys())) + 1
  const width = PAD * 2 + levels * NODE_W + (levels - 1) * GAP_X
  const height = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * GAP_Y

  const edges = []
  for (const src of order) {
    for (const tgt of adj.get(src)) {
      const a = pos.get(src)
      const b = pos.get(tgt)
      if (a && b) edges.push({ from: src, to: tgt, a, b })
    }
  }

  const boxes = order.map((k) => {
    const n = byKey.get(k)
    return {
      key: k,
      name: n.name || shortType(n.type) || k,
      type: shortType(n.type),
      cls: getNodeClass(n.type),
      outputs: adj.get(k) || [],
      ...pos.get(k),
    }
  })

  return { boxes, edges, width: Math.max(width, 240), height: Math.max(height, NODE_H + PAD * 2) }
}

/**
 * Build the screen-reader label for a single node: its name, type, and where
 * it connects to. Kept pure so the wording stays testable without rendering.
 */
export function nodeAriaLabel(box, t) {
  const base = t('previewNodeAria', { name: box.name, type: box.type })
  const conn = (box.outputs && box.outputs.length)
    ? t('previewNodeConnects', { targets: box.outputs.join(', ') })
    : t('previewNodeNoConnect')
  return base + ' \u2014 ' + conn
}

/** Short "N nodes, M connections" summary used as the diagram's group label. */
export function summaryAriaLabel(layout, t) {
  return t('previewSummary', { nodes: layout.boxes.length, connections: layout.edges.length })
}
