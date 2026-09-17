'use client'

import { deriveModelOptions } from '../../refs'
import styles from './derive-dialog.module.css'
import type { RefAsset } from '../../../_actions/references.action'
import {
  Button,
  CostNote,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '#/components'
import { estimateImageCostCents } from '#/features/ai-images/models'
import { imageUrl } from '#/lib/image-url'

/**
 * New from this (#690): a sheet, some words, and which models to try.
 *
 * **Locked down, on purpose.** No reference roles, no aspect, no resolution,
 * no enhance -- the only choices are the sheet you started from, what you say,
 * and the models. Everything else is fixed, which is what makes a press cheap
 * enough to make casually.
 *
 * The models are a multi-select rather than a picker because every one ticked
 * is one generation: ticking all three adds three assets to compare. The sheet
 * itself is never touched -- the result is a new asset on the same tab.
 */
export function DeriveDialog({
  asset,
  words,
  onWordsChange,
  models,
  onToggleModel,
  busy,
  onSubmit,
  onOpenChange,
}: {
  asset: RefAsset | null
  words: string
  onWordsChange: (value: string) => void
  models: Array<string>
  onToggleModel: (slug: string) => void
  busy: boolean
  onSubmit: () => void
  onOpenChange: (open: boolean) => void
}) {
  const options = deriveModelOptions()
  /* One run per model ticked, always with a reference -- so the edit endpoint's
     price, which for the megapixel-billed pair is about twice the other one. */
  const { cents, unpriced } = estimateImageCostCents(models, 1, true)

  return (
    <Dialog open={asset !== null} onOpenChange={onOpenChange}>
      <DialogContent className={styles.content}>
        <DialogHeader>
          <DialogTitle>New from {asset?.title ?? 'this'}</DialogTitle>
        </DialogHeader>
        {asset && (
          <img
            className={styles.sheet}
            src={imageUrl(asset.id, 'thumb')}
            alt={asset.title}
          />
        )}
        <Textarea
          value={words}
          onChange={(event) => onWordsChange(event.target.value)}
          rows={3}
          placeholder="A top-down plan of this floor. Her from behind, walking. This dock at night."
        />
        <div className={styles.models}>
          {options.map((option) => (
            <Button
              key={option.slug}
              size="sm"
              variant={models.includes(option.slug) ? 'primary' : 'secondary'}
              aria-pressed={models.includes(option.slug)}
              onClick={() => onToggleModel(option.slug)}
            >
              {option.name}
            </Button>
          ))}
        </div>
        <div className={styles.foot}>
          {/* Printed before the press, as everywhere else that spends. */}
          <CostNote cents={cents} unpriced={unpriced} />
          <Button
            variant="primary"
            loading={busy}
            disabled={!words.trim() || models.length === 0}
            onClick={onSubmit}
          >
            Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
