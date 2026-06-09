import { describe, it, expect } from 'vitest'
import { formatRelativeTime, formatAbsoluteTime } from './timeFormat.js'

// Fixed reference point so the relative math is deterministic.
const NOW = new Date('2026-06-09T12:00:00Z').getTime()
const SEC = 1000
const MIN = 60 * SEC
const HOUR = 60 * MIN
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('returns the justNow string for very fresh timestamps (< ~45s)', () => {
    expect(formatRelativeTime(NOW, { now: NOW, justNow: 'just now' })).toBe('just now')
    expect(formatRelativeTime(NOW - 10 * SEC, { now: NOW, justNow: 'just now' })).toBe('just now')
    expect(formatRelativeTime(NOW - 30 * SEC, { now: NOW, justNow: 'baru saja', lang: 'id' })).toBe('baru saja')
  })

  it('formats minutes ago in English', () => {
    expect(formatRelativeTime(NOW - 2 * MIN, { now: NOW, lang: 'en' })).toBe('2 minutes ago')
  })

  it('formats hours and days ago in English', () => {
    expect(formatRelativeTime(NOW - 3 * HOUR, { now: NOW, lang: 'en' })).toBe('3 hours ago')
    expect(formatRelativeTime(NOW - 2 * DAY, { now: NOW, lang: 'en' })).toBe('2 days ago')
  })

  it('localizes to Indonesian', () => {
    // Indonesian RelativeTimeFormat: "2 menit yang lalu"
    const out = formatRelativeTime(NOW - 2 * MIN, { now: NOW, lang: 'id' })
    expect(out).toContain('menit')
    expect(out).toContain('lalu')
  })

  it('falls back to English for an unknown locale instead of throwing', () => {
    expect(() => formatRelativeTime(NOW - 2 * MIN, { now: NOW, lang: 'zz-NONSENSE' })).not.toThrow()
  })

  it('returns empty string for invalid input', () => {
    expect(formatRelativeTime(undefined, { now: NOW })).toBe('')
    expect(formatRelativeTime(NaN, { now: NOW })).toBe('')
    expect(formatRelativeTime('nope', { now: NOW })).toBe('')
  })
})

describe('formatAbsoluteTime', () => {
  it('produces a non-empty localized string for a valid timestamp', () => {
    expect(formatAbsoluteTime(NOW, 'en')).toBeTruthy()
    expect(formatAbsoluteTime(NOW, 'id')).toBeTruthy()
  })

  it('returns empty string for invalid input', () => {
    expect(formatAbsoluteTime(undefined)).toBe('')
    expect(formatAbsoluteTime(NaN)).toBe('')
  })
})
