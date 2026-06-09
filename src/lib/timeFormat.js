// Localized relative-time formatting for history entries, e.g. "2 minutes ago"
// / "2 menit lalu". Uses the native Intl.RelativeTimeFormat so the wording
// follows the UI language without any dependency or translation table. Pure
// and side-effect free so it stays trivial to unit-test.

// Thresholds in seconds → the unit we render at that scale. Checked in order.
const DIVISIONS = [
  { limit: 60, unit: 'second', secs: 1 },
  { limit: 3600, unit: 'minute', secs: 60 },
  { limit: 86400, unit: 'hour', secs: 3600 },
  { limit: 604800, unit: 'day', secs: 86400 },
  { limit: 2629800, unit: 'week', secs: 604800 },
  { limit: 31557600, unit: 'month', secs: 2629800 },
  { limit: Infinity, unit: 'year', secs: 31557600 },
];

/**
 * Format `ts` (epoch ms) relative to `now` (epoch ms), localized to `lang`.
 * Anything under ~45 seconds collapses to a friendly "just now" string the
 * caller passes in (so it can be translated), since RelativeTimeFormat would
 * otherwise say "in 0 seconds"/"3 seconds ago" which reads worse for fresh
 * entries. Returns '' for invalid input.
 *
 * @param {number} ts        entry timestamp (epoch ms)
 * @param {object} [opts]
 * @param {number} [opts.now] reference time (epoch ms), defaults to Date.now()
 * @param {string} [opts.lang] BCP-47 language tag ('id' / 'en'), default 'en'
 * @param {string} [opts.justNow] text for the < ~45s window, default 'just now'
 * @returns {string}
 */
export function formatRelativeTime(ts, { now = Date.now(), lang = 'en', justNow = 'just now' } = {}) {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return '';
  const diffMs = ts - now; // negative = in the past
  const absSecs = Math.abs(diffMs) / 1000;

  if (absSecs < 45) return justNow;

  let rtf;
  try {
    rtf = new Intl.RelativeTimeFormat(lang || 'en', { numeric: 'auto' });
  } catch (e) {
    // Unknown locale → fall back to English rather than throwing.
    rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  }

  for (const d of DIVISIONS) {
    if (absSecs < d.limit) {
      const value = Math.round(diffMs / 1000 / d.secs);
      return rtf.format(value, d.unit);
    }
  }
  return '';
}

/**
 * Absolute, locale-aware date+time string for the hover tooltip (title attr),
 * e.g. "9 Jun 2026, 13.00". Returns '' for invalid input.
 */
export function formatAbsoluteTime(ts, lang = 'en') {
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return '';
  try {
    return new Intl.DateTimeFormat(lang || 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ts));
  } catch (e) {
    return new Date(ts).toISOString();
  }
}
