import styles from './endpoint-rail.module.css'
import type { SavedEndpoint } from '../../_actions/endpoints.action'
import { cx } from '#/lib/utils'

/**
 * The endpoints kept, as buttons.
 *
 * **Single-select, and that is not a placeholder.** One endpoint's controls at
 * a time is the shape the real Endpoint Explorer wants -- the same call Video
 * made in #417, for the same reason: these models disagree about almost
 * everything, so anything showing two at once has to intersect them and the
 * differences are exactly what you came for.
 *
 * The label is the last two segments of the id, not the whole path. A rail of
 * `fal-ai/bytedance/seedream/v5/lite/edit` at 20rem is a column of ellipses,
 * and the tail is the half that distinguishes them.
 */
export function EndpointRail({
  endpoints,
  selectedId,
  onSelect,
}: {
  endpoints: Array<SavedEndpoint>
  selectedId: string | null
  onSelect: (endpoint: SavedEndpoint) => void
}) {
  return (
    <aside className={styles.rail}>
      <h2 className={styles.heading}>Saved</h2>
      {endpoints.length === 0 ? (
        <p className={styles.empty}>
          Check an endpoint, then Save it to keep it here.
        </p>
      ) : (
        <ul className={styles.list}>
          {endpoints.map((endpoint) => (
            <li key={endpoint.id}>
              <button
                type="button"
                onClick={() => onSelect(endpoint)}
                aria-current={endpoint.id === selectedId ? 'true' : undefined}
                title={endpoint.endpointId}
                className={cx(
                  styles.item,
                  endpoint.id === selectedId && styles.itemActive,
                )}
              >
                <span className={styles.label}>{endpoint.label}</span>
                {/* A dot, not the word: at this width the verdict is a thing
                    you scan down the column, and the card says it in full the
                    moment you select one. */}
                <span
                  className={cx(
                    styles.dot,
                    endpoint.supported ? styles.dotOk : styles.dotBad,
                  )}
                  aria-label={
                    endpoint.supported ? 'supported' : 'not supported'
                  }
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
