// Per-provider API key storage.
//
// The app historically kept a single key shared across all providers
// ('n8n_gen_api_key'). Users juggling Anthropic + Groq + OpenRouter had to
// re-paste a key on every provider switch. Keys are now kept in a map
// { providerId: key } and persisted (opt-in, same "remember" toggle as
// before) as one JSON blob under 'n8n_gen_api_keys'.
//
// Migration: a legacy single key can't be attributed to a specific provider,
// so it is moved into the SHARED ('*') slot. keyForProvider() falls back to
// the shared slot until the user types a provider-specific key, which exactly
// preserves the old behaviour for existing users while new edits become
// per-provider. The legacy entries are removed after migration.
//
// SECURITY: same accepted trade-off as before — keys persist in plaintext in
// localStorage, opt-in only, with a visible warning in the UI. See the notice
// in App.jsx before adding any third-party script to the page.

export const KEYS_STORAGE_KEY = 'n8n_gen_api_keys'
export const REMEMBER_STORAGE_KEY = 'n8n_gen_remember'
export const LEGACY_KEY_STORAGE_KEY = 'n8n_gen_api_key'
export const SHARED_SLOT = '*'

function safeStorage(storage) {
  if (storage) return storage
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Load remembered keys. Returns { keys, remember }.
 * Migrates the legacy single-key format into the shared slot on first read.
 */
export function loadStoredKeys(storage) {
  const store = safeStorage(storage)
  if (!store) return { keys: {}, remember: false }
  let remember = false
  let keys = {}
  try {
    remember = store.getItem(REMEMBER_STORAGE_KEY) === 'true'
    const raw = store.getItem(KEYS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string' && v) keys[k] = v
        }
      }
    }
    // Legacy migration: single shared key -> shared slot (only if remembered).
    const legacy = store.getItem(LEGACY_KEY_STORAGE_KEY)
    if (legacy) {
      if (remember && !keys[SHARED_SLOT]) {
        keys[SHARED_SLOT] = legacy
        store.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys))
      }
      store.removeItem(LEGACY_KEY_STORAGE_KEY)
    }
  } catch {
    // Corrupt JSON or storage access failure: start clean rather than crash.
    keys = {}
  }
  if (!remember) return { keys: {}, remember: false }
  return { keys, remember }
}

/**
 * Persist (or clear) the key map according to the remember toggle.
 * Storage failures (quota, disabled storage) are swallowed: persistence is a
 * convenience, never worth breaking the app over.
 */
export function persistKeys(keys, remember, storage) {
  const store = safeStorage(storage)
  if (!store) return
  try {
    if (remember) {
      const clean = {}
      for (const [k, v] of Object.entries(keys || {})) {
        if (typeof v === 'string' && v) clean[k] = v
      }
      store.setItem(KEYS_STORAGE_KEY, JSON.stringify(clean))
      store.setItem(REMEMBER_STORAGE_KEY, 'true')
    } else {
      store.removeItem(KEYS_STORAGE_KEY)
      store.removeItem(LEGACY_KEY_STORAGE_KEY)
      store.setItem(REMEMBER_STORAGE_KEY, 'false')
    }
  } catch {
    /* best effort */
  }
}

/** The key to use for a provider: its own entry, else the shared legacy slot. */
export function keyForProvider(keys, provider) {
  if (!keys) return ''
  return keys[provider] || keys[SHARED_SLOT] || ''
}

/**
 * Immutable update of one provider's key. An empty value removes the entry
 * (and clears the shared fallback so "I deleted my key" actually sticks
 * instead of resurrecting the legacy key).
 */
export function setKeyForProvider(keys, provider, value) {
  const next = { ...(keys || {}) }
  if (value) {
    next[provider] = value
  } else {
    delete next[provider]
    delete next[SHARED_SLOT]
  }
  return next
}
