import { describe, it, expect } from 'vitest'
import {
  loadStoredKeys,
  persistKeys,
  keyForProvider,
  setKeyForProvider,
  KEYS_STORAGE_KEY,
  REMEMBER_STORAGE_KEY,
  LEGACY_KEY_STORAGE_KEY,
  SHARED_SLOT,
} from './apiKeyStore.js'

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v) },
    removeItem: (k) => { delete data[k] },
  }
}

describe('loadStoredKeys', () => {
  it('returns empty state when nothing is stored', () => {
    expect(loadStoredKeys(fakeStorage())).toEqual({ keys: {}, remember: false })
  })

  it('loads a remembered per-provider map', () => {
    const store = fakeStorage({
      [REMEMBER_STORAGE_KEY]: 'true',
      [KEYS_STORAGE_KEY]: JSON.stringify({ anthropic: 'sk-ant', groq: 'gsk-1' }),
    })
    expect(loadStoredKeys(store)).toEqual({
      keys: { anthropic: 'sk-ant', groq: 'gsk-1' },
      remember: true,
    })
  })

  it('returns no keys when remember is off, even if a map exists', () => {
    const store = fakeStorage({
      [REMEMBER_STORAGE_KEY]: 'false',
      [KEYS_STORAGE_KEY]: JSON.stringify({ anthropic: 'sk-ant' }),
    })
    expect(loadStoredKeys(store)).toEqual({ keys: {}, remember: false })
  })

  it('migrates a remembered legacy single key into the shared slot', () => {
    const store = fakeStorage({
      [REMEMBER_STORAGE_KEY]: 'true',
      [LEGACY_KEY_STORAGE_KEY]: 'sk-old',
    })
    const { keys, remember } = loadStoredKeys(store)
    expect(remember).toBe(true)
    expect(keys).toEqual({ [SHARED_SLOT]: 'sk-old' })
    // legacy entry is gone, new map is written
    expect(store.data[LEGACY_KEY_STORAGE_KEY]).toBeUndefined()
    expect(JSON.parse(store.data[KEYS_STORAGE_KEY])).toEqual({ [SHARED_SLOT]: 'sk-old' })
  })

  it('drops an un-remembered legacy key instead of migrating it', () => {
    const store = fakeStorage({ [LEGACY_KEY_STORAGE_KEY]: 'sk-old' })
    expect(loadStoredKeys(store)).toEqual({ keys: {}, remember: false })
    expect(store.data[LEGACY_KEY_STORAGE_KEY]).toBeUndefined()
  })

  it('survives corrupt JSON and non-string values', () => {
    const store = fakeStorage({
      [REMEMBER_STORAGE_KEY]: 'true',
      [KEYS_STORAGE_KEY]: '{not json',
    })
    expect(loadStoredKeys(store).keys).toEqual({})

    const store2 = fakeStorage({
      [REMEMBER_STORAGE_KEY]: 'true',
      [KEYS_STORAGE_KEY]: JSON.stringify({ anthropic: 'ok', openai: 42, groq: '' }),
    })
    expect(loadStoredKeys(store2).keys).toEqual({ anthropic: 'ok' })
  })
})

describe('persistKeys', () => {
  it('writes only non-empty string keys when remember is on', () => {
    const store = fakeStorage()
    persistKeys({ anthropic: 'sk-ant', openai: '', custom: 'k' }, true, store)
    expect(JSON.parse(store.data[KEYS_STORAGE_KEY])).toEqual({ anthropic: 'sk-ant', custom: 'k' })
    expect(store.data[REMEMBER_STORAGE_KEY]).toBe('true')
  })

  it('clears the map and the legacy key when remember is turned off', () => {
    const store = fakeStorage({
      [KEYS_STORAGE_KEY]: '{"anthropic":"sk"}',
      [LEGACY_KEY_STORAGE_KEY]: 'sk-old',
      [REMEMBER_STORAGE_KEY]: 'true',
    })
    persistKeys({ anthropic: 'sk' }, false, store)
    expect(store.data[KEYS_STORAGE_KEY]).toBeUndefined()
    expect(store.data[LEGACY_KEY_STORAGE_KEY]).toBeUndefined()
    expect(store.data[REMEMBER_STORAGE_KEY]).toBe('false')
  })

  it('swallows storage write failures', () => {
    const store = {
      getItem: () => null,
      setItem: () => { throw new Error('QuotaExceededError') },
      removeItem: () => {},
    }
    expect(() => persistKeys({ a: 'b' }, true, store)).not.toThrow()
  })
})

describe('keyForProvider', () => {
  it('prefers the provider-specific key over the shared slot', () => {
    const keys = { anthropic: 'sk-ant', [SHARED_SLOT]: 'sk-shared' }
    expect(keyForProvider(keys, 'anthropic')).toBe('sk-ant')
    expect(keyForProvider(keys, 'groq')).toBe('sk-shared')
  })

  it('returns empty string when nothing matches', () => {
    expect(keyForProvider({}, 'openai')).toBe('')
    expect(keyForProvider(null, 'openai')).toBe('')
  })
})

describe('setKeyForProvider', () => {
  it('sets a key immutably', () => {
    const before = { anthropic: 'a' }
    const after = setKeyForProvider(before, 'groq', 'g')
    expect(after).toEqual({ anthropic: 'a', groq: 'g' })
    expect(before).toEqual({ anthropic: 'a' })
  })

  it('clearing a key removes the entry and the shared fallback', () => {
    const before = { anthropic: 'a', [SHARED_SLOT]: 'legacy' }
    const after = setKeyForProvider(before, 'anthropic', '')
    expect(after).toEqual({})
    // a different provider keeps its own key when one is cleared
    const before2 = { anthropic: 'a', groq: 'g' }
    expect(setKeyForProvider(before2, 'anthropic', '')).toEqual({ groq: 'g' })
  })
})
