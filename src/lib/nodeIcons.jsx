// Curated, dependency-free icon set that approximates n8n's node glyphs.
//
// n8n's real icon set is large and separately licensed, so instead of shipping
// it we draw simple stroke glyphs keyed by node-type keywords, with a generic
// fallback for anything unrecognised. Strokes use `currentColor` so the colour
// is driven by the node's category in CSS (trigger / action / logic).

// Pick an icon key from a node's (lowercased) type string. Order matters:
// more specific / easily-confused checks come first (e.g. message before "ai",
// since "gmail"/"email" contain the letters "ai").
function iconKeyForType(rawType) {
  const t = String(rawType || '').toLowerCase()
  if (!t) return 'generic'
  if (t.includes('stickynote')) return 'note'
  if (/(webhook|trigger|cron|schedule|interval|manualtrigger|formtrigger)/.test(t)) return 'trigger'
  if (/(postgres|mysql|mongo|redis|supabase|sqlite|\bsql\b|database|airtable|baserow)/.test(t)) return 'database'
  if (/(telegram|slack|discord|gmail|email|mail|whatsapp|twilio|sendgrid|mattermost|pushover)/.test(t)) return 'message'
  if (/(httprequest|graphql|respondtowebhook|http)/.test(t)) return 'http'
  if (/(googlesheets|spreadsheet|notion|excel|sheet|table)/.test(t)) return 'table'
  if (/(merge)/.test(t)) return 'merge'
  if (/(\.if|switch|filter|router)/.test(t)) return 'branch'
  if (/(code|function|set|edit|noop|aggregate|itemlists|datetime)/.test(t)) return 'code'
  if (/(openai|anthropic|langchain|lmchat|agent|llm|embedding|chaintool|vectorstore)/.test(t)) return 'ai'
  return 'generic'
}

// SVG body (stroke, no fill) for each icon key. 24x24 viewBox.
const GLYPHS = {
  trigger: <path d="M13 2 5 13h6l-1 9 9-12h-6z" />,
  http: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c3.5 2.5 3.5 15.5 0 18M12 3c-3.5 2.5-3.5 15.5 0 18" />
    </g>
  ),
  database: (
    <g>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
      <path d="M5 12c0 1.66 3.13 3 7 3s7-1.34 7-3" />
    </g>
  ),
  message: (
    <g>
      <path d="M21 3 3 10.5l7 2.5 2.5 7z" />
      <path d="M21 3 10 13.5" />
    </g>
  ),
  branch: (
    <g>
      <path d="M6 4v6a3 3 0 0 0 3 3h8" />
      <path d="M14 10l4 3-4 3" />
      <circle cx="6" cy="4" r="1.6" />
    </g>
  ),
  merge: (
    <g>
      <path d="M18 4v6a3 3 0 0 1-3 3H6" />
      <path d="M10 10 6 13l4 3" />
      <circle cx="18" cy="4" r="1.6" />
    </g>
  ),
  code: (
    <g>
      <path d="M9 7 4 12l5 5" />
      <path d="M15 7l5 5-5 5" />
    </g>
  ),
  table: (
    <g>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M9 4v16" />
    </g>
  ),
  ai: (
    <g>
      <path d="M12 3l1.7 4.6L18 9l-4.3 1.4L12 15l-1.7-4.6L6 9l4.3-1.4z" />
      <path d="M18 15l.9 2.2L21 18l-2.1.8L18 21l-.9-2.2L15 18l2.1-.8z" />
    </g>
  ),
  note: (
    <g>
      <path d="M5 4h14v10l-5 5H5z" />
      <path d="M19 14h-5v5" />
    </g>
  ),
  generic: (
    <g>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="12" cy="12" r="3" />
    </g>
  ),
}

/**
 * Inline SVG icon for an n8n node type. `size` controls width/height in px.
 * Decorative by default (aria-hidden); callers describe the node in text.
 */
export default function NodeIcon({ type, size = 26 }) {
  const glyph = GLYPHS[iconKeyForType(type)] || GLYPHS.generic
  return (
    <svg
      className="wf-node-glyph"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyph}
    </svg>
  )
}
