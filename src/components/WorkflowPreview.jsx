import { useMemo } from 'react'
import {
  NODE_W,
  NODE_H,
  computeLayout,
  nodeAriaLabel,
  summaryAriaLabel,
} from '../lib/workflowLayout'
import NodeIcon from '../lib/nodeIcons'

/**
 * Lightweight, dependency-free visual preview of an n8n workflow, styled to
 * resemble the real n8n canvas: each node is a rounded icon card (triggers get
 * the pill-left shape) with its name below it and input/output ports on the
 * sides, joined by bezier edges (dashed for non-main / sub-node links). Sticky
 * notes render as translucent note cards.
 *
 * The layout math and accessibility wording live in lib/workflowLayout.js
 * (pure + unit-tested); this component only renders the result.
 *
 * Accessibility: the diagram is exposed as a labelled group/list whose items
 * (the nodes) are focusable and self-describing, so keyboard and screen-reader
 * users can traverse the workflow. The decorative SVG edges stay aria-hidden.
 */
export default function WorkflowPreview({ workflow, t }) {
  const layout = useMemo(() => computeLayout(workflow), [workflow])

  if (!layout) {
    return <div className="wf-preview-empty">{t ? t('previewEmpty') : 'No nodes to preview'}</div>
  }

  const { boxes, edges, width, height } = layout
  const tr = t || ((k) => k)
  const groupLabel = `${tr('previewAria')}: ${summaryAriaLabel(layout, tr)}`

  return (
    <div className="wf-preview" role="group" aria-label={groupLabel}>
      <div className="wf-canvas" style={{ width, height }} role="list">
        <svg className="wf-edges" width={width} height={height} aria-hidden="true">
          {edges.map((e, i) => {
            const x1 = e.a.x + NODE_W
            const y1 = e.a.y + NODE_H / 2
            const x2 = e.b.x
            const y2 = e.b.y + NODE_H / 2
            const mx = (x1 + x2) / 2
            return (
              <path
                key={i}
                className={'wf-edge' + (e.type && e.type !== 'main' ? ' wf-edge-sub' : '')}
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
              />
            )
          })}
        </svg>

        {boxes.map((b) => {
          if (b.isSticky) {
            return (
              <div
                key={b.key}
                className="wf-sticky"
                style={{ left: b.x, top: b.y, width: NODE_W, minHeight: NODE_H }}
                role="listitem"
                tabIndex={0}
                aria-label={nodeAriaLabel(b, tr)}
                title={b.name}
              >
                <span className="wf-sticky-text" aria-hidden="true">{b.content || b.name}</span>
              </div>
            )
          }
          return (
            <div
              key={b.key}
              className={'wf-node-wrap' + (b.isTrigger ? ' trigger' : '')}
              style={{ left: b.x, top: b.y, width: NODE_W, height: NODE_H }}
              role="listitem"
              tabIndex={0}
              aria-label={nodeAriaLabel(b, tr)}
              title={b.name + ' (' + b.type + ')'}
            >
              <div className={'wf-node ' + b.cls} aria-hidden="true">
                {b.hasInput && <span className="wf-port wf-port-in" />}
                <NodeIcon type={b.rawType} />
                {b.hasOutput && <span className="wf-port wf-port-out" />}
              </div>
              <span className="wf-node-name" aria-hidden="true">{b.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
