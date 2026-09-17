'use client'

import { SheetCard } from '../sheet-card/sheet-card'
import { KIND_LABEL, KIND_NOUN } from '../../refs'
import styles from './reference-tab.module.css'
import type { RefAsset } from '../../../_actions/references.action'
import type { RefKind } from '../../../_lib/types'
import { Button, EmptyState, ImageGrid } from '#/components'

/**
 * One tab of reference sheets (#690).
 *
 * **Extract, derive, delete, and nothing else.** Every asset here is additive
 * -- a second Extract adds another set beside the first, New from this adds a
 * sheet beside the one it came from -- and the collection is pruned by Delete
 * until what is left is what is useful. There is no replace, no reorder and no
 * select-many: a flat set with a delete on each is the whole mechanism.
 *
 * The grid is Images' own `ImageGrid` at the same size, so the two walls have
 * the same columns, the same gap and the same reflow. What the cards do inside
 * it is `SheetCard`'s.
 */
export function ReferenceTab({
  kind,
  assets,
  busy,
  onExtract,
  onDerive,
  onDelete,
  onOpen,
}: {
  kind: RefKind
  assets: Array<RefAsset>
  busy: boolean
  onExtract: () => void
  onDerive: (asset: RefAsset) => void
  onDelete: (asset: RefAsset) => void
  onOpen: (asset: RefAsset) => void
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
      <ImageGrid size="lg">
        {assets.map((asset) => (
          <SheetCard
            key={asset.id}
            asset={asset}
            onDerive={onDerive}
            onDelete={onDelete}
            onOpen={onOpen}
          />
        ))}
      </ImageGrid>
    </div>
  )
}
