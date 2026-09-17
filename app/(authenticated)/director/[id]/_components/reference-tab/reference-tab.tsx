'use client'

import { Sparkles, Trash2 } from 'lucide-react'
import { KIND_LABEL, KIND_NOUN } from '../../refs'
import styles from './reference-tab.module.css'
import type { RefAsset } from '../../../_actions/references.action'
import type { RefKind } from '../../../_lib/types'
import { Button, EmptyState } from '#/components'
import { imageUrl } from '#/lib/image-url'

/**
 * One tab of reference sheets (#690).
 *
 * **Extract, derive, delete, and nothing else.** Every asset here is additive
 * -- a second Extract adds another set beside the first, New from this adds a
 * sheet beside the one it came from -- and the collection is pruned by Delete
 * until what is left is what is useful. There is no replace, no reorder and no
 * select-many: a flat set with a delete on each is the whole mechanism.
 *
 * A sheet still being made holds its place as a box that says so, on the run's
 * rule: the thing you just paid for must not vanish until it lands.
 */
export function ReferenceTab({
  kind,
  assets,
  busy,
  onExtract,
  onDerive,
  onDelete,
}: {
  kind: RefKind
  assets: Array<RefAsset>
  busy: boolean
  onExtract: () => void
  onDerive: (asset: RefAsset) => void
  onDelete: (asset: RefAsset) => void
}) {
  const label = KIND_LABEL[kind]
  const extract = (
    <Button variant="primary" onClick={onExtract} loading={busy}>
      Extract {label.toLowerCase()}
    </Button>
  )

  if (assets.length === 0) {
    return (
      <div className={styles.empty}>
        <EmptyState title={`No ${label.toLowerCase()} yet`}>
          Read the session&rsquo;s clips and draw a sheet for each{' '}
          {KIND_NOUN[kind]} in them.
        </EmptyState>
        {extract}
      </div>
    )
  }

  return (
    <div className={styles.tab}>
      <div className={styles.bar}>
        <p className={styles.count}>
          {assets.length} {assets.length === 1 ? 'sheet' : 'sheets'}
        </p>
        {extract}
      </div>
      <ul className={styles.grid}>
        {assets.map((asset) => (
          <li key={asset.id} className={styles.card}>
            <div className={styles.sheet}>
              {asset.status === 'completed' ? (
                <img
                  src={imageUrl(asset.id)}
                  alt={asset.title}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <p className={styles.state}>
                  {asset.status === 'pending'
                    ? 'Drawing...'
                    : (asset.generation_error ?? 'That one failed.')}
                </p>
              )}
            </div>
            <div className={styles.foot}>
              <p
                className={styles.title}
                title={asset.description ?? undefined}
              >
                {asset.title}
              </p>
              <Button
                size="sm"
                onClick={() => onDerive(asset)}
                disabled={asset.status !== 'completed'}
                title="New from this"
              >
                <Sparkles size={14} />
                New from this
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(asset)}
                aria-label={`Delete ${asset.title}`}
                title="Delete"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
