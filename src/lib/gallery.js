// Public workflow gallery, built entirely on the share-link format — no
// backend. The data lives in a static `gallery.json` next to the app (curated
// in the repo via pull requests), and every entry carries a share token in the
// exact same format as #w= links, so loading a gallery item reuses the
// battle-tested decodeShare -> loadWorkflow path (versioning, forward
// compatibility and corruption handling included).

/** Where the gallery data is served from (respects the Pages base path). */
export function galleryUrl() {
  return import.meta.env.BASE_URL + 'gallery.json';
}

function isLocalizedString(v) {
  return !!v && typeof v === 'object' && typeof v.id === 'string' && typeof v.en === 'string';
}

/**
 * Validate raw gallery data and return only the well-formed entries. Tolerant
 * by design: one malformed entry (e.g. from a bad PR) must not take down the
 * whole gallery, so invalid items are dropped instead of throwing.
 * @returns {Array<{id: string, title: object, description: object, tags: string[], nodes: number, token: string}>}
 */
export function parseGallery(data) {
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.filter((item) =>
    !!item && typeof item === 'object' &&
    typeof item.id === 'string' && item.id &&
    isLocalizedString(item.title) &&
    isLocalizedString(item.description) &&
    typeof item.token === 'string' && item.token.length > 0
  ).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    tags: Array.isArray(item.tags) ? item.tags.filter((x) => typeof x === 'string') : [],
    nodes: typeof item.nodes === 'number' ? item.nodes : null,
    token: item.token,
  }));
}

/**
 * Fetch and parse the gallery. Never throws — returns { items, error } so the
 * panel can show a friendly message when the file is missing or malformed.
 * @param {typeof fetch} [fetchImpl] injectable for tests.
 */
export async function fetchGallery(fetchImpl) {
  const f = fetchImpl || fetch;
  try {
    const res = await f(galleryUrl());
    if (!res.ok) return { items: [], error: 'unavailable' };
    const data = await res.json();
    const items = parseGallery(data);
    return { items, error: items.length === 0 ? 'empty' : null };
  } catch (e) {
    return { items: [], error: 'unavailable' };
  }
}
