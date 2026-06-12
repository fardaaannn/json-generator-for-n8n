import { useState, useCallback } from 'react'
import { fetchGallery } from '../lib/gallery'

// Public workflow gallery: a collapsible list of curated example workflows,
// each stored as a share-link token in the static gallery.json (no backend).
// The data is fetched lazily on first expand so visitors who never open the
// gallery pay nothing for it. Loading an entry goes through the same
// decodeShare path as a #w= link (handled by the parent via onLoadEntry).
export default function GalleryPanel({ t, uiLang, onLoadEntry }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState(null) // null = not fetched yet
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const toggle = useCallback(async () => {
    const next = !open
    setOpen(next)
    if (next && items === null && !loading) {
      setLoading(true)
      const result = await fetchGallery()
      setItems(result.items)
      setError(result.error)
      setLoading(false)
    }
  }, [open, items, loading])

  const L = uiLang === 'id' ? 'id' : 'en'

  return (
    <div className="n8n-import">
      <button
        type="button"
        className="n8n-import-toggle"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="gallery-body"
      >
        <span>{t('galleryTitle')}</span>
        <span className="n8n-import-chevron" aria-hidden="true">{open ? '\u2212' : '+'}</span>
      </button>
      {open && (
        <div className="n8n-import-body" id="gallery-body">
          <p className="security-notice">{t('galleryDesc')}</p>
          {loading && <p className="gallery-state">{t('galleryLoading')}</p>}
          {!loading && error === 'unavailable' && <p className="gallery-state">{t('galleryError')}</p>}
          {!loading && error === 'empty' && <p className="gallery-state">{t('galleryEmpty')}</p>}
          {!loading && items && items.length > 0 && (
            <ul className="gallery-list">
              {items.map((item) => (
                <li key={item.id} className="gallery-item">
                  <div className="gallery-item-info">
                    <span className="gallery-item-title">{item.title[L]}</span>
                    <span className="gallery-item-desc">{item.description[L]}</span>
                    <span className="gallery-item-meta">
                      {item.nodes != null && <span className="gallery-item-nodes">{t('galleryNodes', { n: item.nodes })}</span>}
                      {item.tags.map((tag) => (
                        <span key={tag} className="gallery-tag">{tag}</span>
                      ))}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary gallery-load-btn"
                    onClick={() => onLoadEntry(item.token)}
                  >
                    {t('galleryLoadBtn')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
