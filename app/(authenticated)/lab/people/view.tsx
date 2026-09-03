'use client'

import { useState } from 'react'
import { Check, Plus, Sparkles, X } from 'lucide-react'
import { LabPage } from '../_components/lab-page/lab-page'
import styles from './view.module.css'
import { useView } from './use-view'
import { MoreLikeDialog } from './_components/more-like-dialog/more-like-dialog'
import type { Tile } from './board'
import { ActionButton, Button, CostNote, IconButton, Input } from '#/components'
import { cx } from '#/lib/utils'

/**
 * A board of people who do not exist, to keep a few of (#578).
 *
 * **It replaces scrolling Pinterest, and that is the whole shape of it.** The
 * work being replaced was never the generating -- it was the triage: scroll
 * past ninety faces, pin ten, and end up with a coherent set shot the same way.
 * So the press is cheap and the board accumulates, discard costs one click and
 * no confirmation, and Keep is the only thing that writes anything down.
 *
 * **What comes off it are candidates, not assets.** A kept face is a first
 * frame for a character developed later in Images, which is why the default
 * model costs half a cent and why thirty in a press is a reasonable thing to
 * ask for.
 *
 * **Two gestures per tile, for two different passes.** `+` is one more like
 * this on Grok with no dialog -- the click-click-click pass. The dialog is the
 * deliberate one: a count and the models, for a face worth spending on. The
 * badge in the corner counts what a tile has already spawned, because after
 * fifteen clicks the thing actually lost is which faces you already chased.
 */
export function View() {
  const v = useView()
  const [riffing, setRiffing] = useState<Tile | null>(null)

  return (
    <LabPage
      title="People"
      question="Ten strangers, shot the same way -- how many are worth developing?"
      instructionFile="src/lib/prompts/people/cast.md"
      error={v.error}
      wide
    >
      <section className={styles.controls}>
        <div className={styles.field}>
          <span className={styles.label}>People</span>
          <Input
            type="number"
            min={1}
            value={String(v.count)}
            onChange={(e) => v.setCount(Number(e.target.value))}
            aria-label="How many people"
            className={styles.count}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Models</span>
          <div className={styles.models}>
            {v.models.map((m) => {
              const on = v.modelIds.includes(m.id)
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={on}
                  className={cx(styles.model, on && styles.modelOn)}
                  onClick={() => v.toggleModel(m.id)}
                >
                  {m.name}
                  {m.price != null && (
                    <span className={styles.price}>${m.price.toFixed(3)}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.press}>
          <ActionButton
            onClick={() => void v.generate()}
            loading={v.isWriting}
            loadingText="Writing the cast"
            disabled={!v.canGenerate}
          >
            {v.modelIds.length > 1
              ? `Generate ${v.count} on ${v.modelIds.length} models`
              : `Generate ${v.count}`}
          </ActionButton>
          <CostNote cents={v.estimate.cents} unpriced={v.estimate.unpriced} />
        </div>
      </section>

      <p className={styles.caveat}>
        {/* Both costs of storing nothing until Keep, said once, where the
            press is. */}
        These runs do not appear in Activity, and the board holds provider urls
        that expire -- keep what you want before you leave it overnight.
        {v.modelIds.length > 1 && (
          <>
            {' '}
            Every person renders on every model, so {v.count} people is{' '}
            {v.count * v.modelIds.length} images.
          </>
        )}
      </p>

      {v.tiles.length > 0 && (
        <section className={styles.boardHead}>
          <span className={styles.boardCount}>
            {v.tiles.length} on the board
          </span>
          <Button variant="ghost" size="sm" onClick={v.clear}>
            Clear
          </Button>
        </section>
      )}

      <div className={styles.board}>
        {v.tiles.map((tile) => {
          const spawned = v.childCount(tile.key)
          const busy = v.busyKey === tile.key
          return (
            <figure
              key={tile.key}
              className={cx(
                styles.tile,
                tile.parentKey && styles.tileChild,
                tile.keptImageId && styles.tileKept,
              )}
            >
              {tile.url ? (
                <img
                  src={tile.url}
                  alt={tile.spec.slice(0, 80)}
                  title={tile.spec}
                  className={styles.image}
                  onError={() => v.markExpired(tile.key)}
                />
              ) : (
                <span className={styles.placeholder}>
                  {tile.status === 'running'
                    ? 'Rendering'
                    : tile.status === 'expired'
                      ? 'Expired'
                      : (tile.error ?? 'Failed')}
                </span>
              )}

              {spawned > 0 && (
                <span
                  className={styles.badge}
                  title={`${spawned} generated from this one`}
                >
                  {spawned}
                </span>
              )}

              <div className={styles.actions}>
                {/* Keep first and checked once done: it is the only gesture
                    here that writes anything, and the only one that is not
                    reversible by pressing again. */}
                <IconButton
                  aria-label={tile.keptImageId ? 'Kept' : 'Keep'}
                  title={tile.keptImageId ? 'In your library' : 'Keep'}
                  disabled={!tile.url || busy || !!tile.keptImageId}
                  onClick={() => void v.keep(tile)}
                >
                  <Check size={15} />
                </IconButton>
                <IconButton
                  aria-label="One more like this"
                  title="One more like this, on Grok"
                  disabled={!tile.url || busy}
                  onClick={() => void v.moreLike(tile)}
                >
                  <Plus size={15} />
                </IconButton>
                <IconButton
                  aria-label="More like this, with options"
                  title="More like this..."
                  disabled={!tile.url || busy}
                  onClick={() => setRiffing(tile)}
                >
                  <Sparkles size={15} />
                </IconButton>
                <IconButton
                  aria-label="Discard"
                  title="Discard"
                  disabled={busy}
                  onClick={() => v.discard(tile.key)}
                >
                  <X size={15} />
                </IconButton>
              </div>

              <figcaption className={styles.caption}>
                {tile.modelName}
              </figcaption>
            </figure>
          )
        })}
      </div>

      <MoreLikeDialog
        tile={riffing}
        onCancel={() => setRiffing(null)}
        onConfirm={(count, modelIds) => {
          const tile = riffing
          setRiffing(null)
          if (tile) void v.moreLike(tile, { count, modelIds })
        }}
      />
    </LabPage>
  )
}
