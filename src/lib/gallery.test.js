import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { parseGallery, fetchGallery } from './gallery'
import { decodeShare } from './shareLink'
import { validateStructure } from './pipeline'

const validItem = {
  id: 'x',
  title: { id: 'Judul', en: 'Title' },
  description: { id: 'Deskripsi', en: 'Description' },
  tags: ['a'],
  nodes: 2,
  token: '1rabc',
}

describe('parseGallery', () => {
  it('accepts well-formed entries', () => {
    const items = parseGallery({ version: 1, items: [validItem] })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'x', nodes: 2, token: '1rabc', tags: ['a'] })
  })

  it('drops malformed entries instead of throwing', () => {
    const items = parseGallery({
      items: [
        validItem,
        null,
        'nope',
        { ...validItem, id: '' },
        { ...validItem, title: 'not localized' },
        { ...validItem, title: { id: 'only id' } },
        { ...validItem, token: '' },
      ],
    })
    expect(items).toHaveLength(1)
  })

  it('normalizes optional fields', () => {
    const items = parseGallery({ items: [{ ...validItem, tags: ['ok', 7, null], nodes: 'three' }] })
    expect(items[0].tags).toEqual(['ok'])
    expect(items[0].nodes).toBeNull()
  })

  it('handles junk top-level data', () => {
    expect(parseGallery(null)).toEqual([])
    expect(parseGallery({})).toEqual([])
    expect(parseGallery({ items: 'oops' })).toEqual([])
  })
})

describe('fetchGallery', () => {
  it('returns items on success', async () => {
    const f = async () => ({ ok: true, json: async () => ({ items: [validItem] }) })
    const { items, error } = await fetchGallery(f)
    expect(items).toHaveLength(1)
    expect(error).toBeNull()
  })

  it('reports unavailable on http errors and network failures', async () => {
    expect((await fetchGallery(async () => ({ ok: false }))).error).toBe('unavailable')
    expect((await fetchGallery(async () => { throw new Error('net') })).error).toBe('unavailable')
  })

  it('reports empty when no entry survives validation', async () => {
    const f = async () => ({ ok: true, json: async () => ({ items: [{ bad: true }] }) })
    expect((await fetchGallery(f)).error).toBe('empty')
  })
})

describe('shipped gallery.json', () => {
  const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/gallery.json'), 'utf8'))

  it('every entry passes validation', () => {
    expect(raw.items.length).toBeGreaterThan(0)
    expect(parseGallery(raw)).toHaveLength(raw.items.length)
  })

  it('every token decodes to a clean, warning-free workflow', async () => {
    for (const item of parseGallery(raw)) {
      const { json, error } = await decodeShare(item.token)
      expect(error).toBeNull()
      const wf = JSON.parse(json)
      // Gallery examples must be exemplary: structural + parameter validation
      // (the same checks users see) must produce zero warnings.
      expect(validateStructure(wf)).toEqual([])
      expect(wf.nodes).toHaveLength(item.nodes)
    }
  })

  it('entry ids are unique', () => {
    const ids = raw.items.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
