'use client'

import { useEffect, useRef } from 'react'
import { Copy, Search } from 'lucide-react'
import { useSearchOverlay } from './use-search-overlay'
import styles from './search-overlay.module.css'
import type { OverlayFilter } from './filter-library'
import { imageUrl } from '#/lib/image-url'

const FILTERS: Array<{ value: OverlayFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'generations', label: 'Generations' },
  { value: 'uploads', label: 'Uploads' },
]

/**
 * Everything you have, one keystroke away (#213).
 *
 * Cmd-F opens it over whatever you were doing, Escape puts you back. It takes
 * two things out and changes nothing: the prompt you typed, and a reference to
 * the image. It is deliberately not a place -- there is no route, no location
 * on a row and no way to navigate from it, because a search you have to travel
 * into has already broken the flow it was meant to protect.
 *
 * Mounted once, in `app-shell.tsx`, which is what "from anywhere" means.
 */
export function SearchOverlay() {
  const {
    isOpen,
    close,
    loading,
    query,
    setQuery,
    filter,
    setFilter,
    results,
    total,
    selectedIds,
    toggleSelected,
    copyPrompt,
    copySelected,
    selectedCount,
  } = useSearchOverlay()

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className={styles.scrim}
      role="dialog"
      aria-modal="true"
      aria-label="Find in your library"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          close()
        }
      }}
    >
      <div className={styles.panel}>
        <div className={styles.search}>
          <Search className={styles.searchIcon} aria-hidden />
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a prompt, a title, a file name"
            aria-label="Filter your library"
            spellCheck={false}
            autoComplete="off"
          />
          <span className={styles.count}>
            {results.length === total
              ? `${total}`
              : `${results.length} of ${total}`}
          </span>
        </div>

        <div className={styles.filters}>
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.filter}
              data-selected={filter === option.value || undefined}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
          <p className={styles.hint}>
            Click to select, Cmd-C to copy, Esc to close
          </p>
        </div>

        <div className={styles.results}>
          {loading && results.length === 0 ? (
            <p className={styles.state}>Loading your library...</p>
          ) : results.length === 0 ? (
            <p className={styles.state}>Nothing matches.</p>
          ) : (
            <ul className={styles.grid}>
              {results.map((row) => (
                <li key={row.id}>
                  <div
                    className={styles.tile}
                    data-selected={selectedIds.has(row.id) || undefined}
                    title={row.prompt ?? row.title}
                    onClick={() => toggleSelected(row.id)}
                  >
                    <img
                      className={styles.thumb}
                      src={imageUrl(row.id, 'thumb')}
                      alt={row.title}
                      loading="lazy"
                      draggable={false}
                    />
                    {row.prompt && (
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.action}
                          title="Copy prompt"
                          onClick={(e) => {
                            e.stopPropagation()
                            void copyPrompt(row)
                          }}
                        >
                          <Copy aria-hidden />
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedCount > 0 && (
          <button
            type="button"
            className={styles.copyButton}
            onClick={() => void copySelected()}
          >
            {selectedCount === 1
              ? 'Copy image'
              : `Copy ${selectedCount} images`}
          </button>
        )}
      </div>
    </div>
  )
}
