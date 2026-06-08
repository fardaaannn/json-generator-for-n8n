import { getNodeClass } from './getNodeClass'

// Node box geometry. The card is a rounded square (icon inside, name rendered
// below it, n8n-style); NODE_W / NODE_H are exported because the renderer needs
// them to size the cards and anchor the SVG edges to each card's centre.
export const NODE_W = 92
export const NODE_H = 92
const GAP_X = 76
const GAP_Y = 58
const PAD = 24
// Extra room reserved around the grid so the name labels (which sit below each
// card and can overhang sideways) aren't clipped by the canvas bounds.
const LABEL_H = 34
const SIDE_PAD = 40

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
  // Guard against null/non-object entries so a malformed node can't crash the
  // whole preview render.
  const keyOf = (n, i) => ((n && typeof n === 'object' && (n.name || n.id)) || ('node-' + i))
  const order = nodes.map((n, i) => keyOf(n, i))
  const byKey = new Map()
  nodes.forEach((n, i) => byKey.set(keyOf(n, i), n))

  // Build adjacency (source -> [targets]) plus a typed edge list. `adj` keeps
  // plain target names (used for column levelling and the `outputs` field that
  // assistive tech reads), while `edgeList` also records each connection's type
  // so the renderer can dash non-main (sub-node / AI) links the way n8n does.
  const adj = new Map(order.map((k) => [k, []]))
  const indeg = new Map(order.map((k) => [k, 0]))
  const edgeList = []
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
            edgeList.push({ from: source, to: tName, type: outName || 'main' })
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
  const width = PAD * 2 + levels * NODE_W + (levels - 1) * GAP_X + SIDE_PAD
  const height = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * GAP_Y + LABEL_H

  const edges = []
  for (const e of edgeList) {
    const a = pos.get(e.from)
    const b = pos.get(e.to)
    if (a && b) edges.push({ from: e.from, to: e.to, type: e.type, a, b })
  }

  const boxes = order.map((k) => {
    const n = byKey.get(k) || {}
    const rawType = (n && typeof n === 'object' && typeof n.type === 'string') ? n.type : ''
    const cls = getNodeClass(rawType)
    const isSticky = /stickynote/i.test(rawType)
    const params = (n && typeof n === 'object' && n.parameters && typeof n.parameters === 'object') ? n.parameters : {}
    return {
      key: k,
      name: n.name || shortType(rawType) || k,
      type: shortType(rawType),
      // Full node type (e.g. "n8n-nodes-base.webhook") so the renderer can pick
      // the right icon; `type` stays the short form used by labels/tests.
      rawType,
      cls,
      isTrigger: cls === 'trigger',
      isSticky,
      // Which ports to draw: input dot only when something feeds in, output dot
      // only when the node feeds something.
      hasInput: (indeg.get(k) || 0) > 0,
      hasOutput: (adj.get(k) || []).length > 0,
      // Sticky-note text (n8n stores it in parameters.content), shown verbatim.
      content: isSticky && typeof params.content === 'string' ? params.content : '',
      outputs: adj.get(k) || [],
      ...pos.get(k),
    }
  })

  return { boxes, edges, width: Math.max(width, 240), height: Math.max(height, NODE_H + PAD * 2 + LABEL_H) }
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
