'use client'

import { useState } from 'react'
import { Plus, Sparkles, X } from 'lucide-react'
import { LabPage } from '../_components/lab-page/lab-page'
import styles from './view.module.css'
import { useView } from './use-view'
import { MoreLikeDialog } from './_components/more-like-dialog/more-like-dialog'
import type { Tile } from './board'
import { ActionButton, Button, CostNote, IconButton, Input } from '#/components'
import { cx } from '#/lib/utils'

type BoardTile = Tile & {
  status: string
  failure: string | null
  url: string | null
  model: string
  spawned: number
}

/**
 * A board of people who do not exist, to develop a few of (#578).
 *
 * **It replaces scrolling Pinterest, and that is the whole shape of it.** The
 * work being replaced was never the generating -- it was the triage: scroll
 * past ninety faces, keep the few worth pursuing, end up with a coherent set
 * shot the same way.
 *
 * **Press it repeatedly rather than asking for ten.** Generate Person writes
 * one person and puts a square down in the same frame; the session that works
 * is press, look, press again, then `+` on the faces worth chasing. Ten at once
 * still works and writes a cast that spreads by construction -- it is the same
 * control with a different number in it.
 *
 * **Every tile is an ordinary picture.** They are in Images from the moment
 * they are asked for, the spend is in Activity, a refresh keeps them, and the X
 * is the gallery's own delete. This page held its own results in the browser
 * for a day, with a Keep button to promote them; all of that was a parallel
 * implementation of what the app already does.
 */
export function View() {
  const v = useView()
  const [riffing, setRiffing] = useState<Tile | null>(null)

  function heldSquare(key: string) {
    return (
      <div key={key} className={cx(styles.tile, styles.tileHeld)}>
        <span className={cx(styles.placeholder, styles.placeholderPending)}>
          Writing
        </span>
      </div>
    )
  }

  function renderTile(tile: BoardTile) {
    return (
      <figure key={tile.recordId} className={styles.tile}>
        {tile.url && tile.status === 'completed' ? (
          <img
            src={tile.url}
            alt={tile.spec.slice(0, 80)}
            title={tile.spec}
            className={styles.image}
          />
        ) : (
          <span
            className={cx(
              styles.placeholder,
              tile.status === 'pending' && styles.placeholderPending,
            )}
          >
            {tile.status === 'pending'
              ? 'Rendering'
              : (tile.failure ?? 'Failed')}
          </span>
        )}

        {tile.spawned > 0 && (
          <span
            className={styles.badge}
            title={`${tile.spawned} generated from this one`}
          >
            {tile.spawned}
          </span>
        )}

        <div className={styles.actions}>
          <IconButton
            aria-label="One more like this"
            title="One more like this"
            disabled={tile.status !== 'completed'}
            onClick={() => void v.moreLike(tile)}
          >
            <Plus size={15} />
          </IconButton>
          <IconButton
            aria-label="More like this, with options"
            title="More like this..."
            disabled={tile.status !== 'completed'}
            onClick={() => setRiffing(tile)}
          >
            <Sparkles size={15} />
          </IconButton>
          {/* The gallery's delete: a finished face goes to Trash, an unfinished
              one goes outright. Nothing here is a special kind of picture. */}
          <IconButton
            aria-label="Delete"
            title="Delete"
            onClick={() => void v.discard(tile.recordId)}
          >
            <X size={15} />
          </IconButton>
        </div>

        <figcaption className={styles.caption}>{tile.model}</figcaption>
      </figure>
    )
  }

  return (
    <LabPage
      title="People"
      question="Strangers, shot the same way -- how many are worth developing?"
      instructionFile="src/lib/prompts/people/cast.md"
      error={v.error}
      wide
    >
      <section className={styles.controls}>
        <div className={styles.press}>
          {/* Never disabled while a press is in flight: pressing it four
              times in a row is how this page is used, and the squares that
              appear are the feedback a spinner would otherwise be giving. */}
          <ActionButton
            onClick={() => void v.generate()}
            disabled={!v.canGenerate}
          >
            {v.count === 1 ? 'Generate Person' : `Generate ${v.count}`}
          </ActionButton>
          <CostNote cents={v.estimate.cents} unpriced={v.estimate.unpriced} />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>At a time</span>
          <Input
            type="number"
            min={1}
            value={String(v.count)}
            onChange={(e) => v.setCount(Number(e.target.value))}
            aria-label="How many people per press"
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
      </section>

      <p className={styles.caveat}>
        Every face is an ordinary generation: it is in Images, the cost is in
        Activity, and the X puts it in Trash.
        {v.modelIds.length > 1 && (
          <>
            {' '}
            Each person renders on every selected model, so a press is{' '}
            {v.count * v.modelIds.length} images.
          </>
        )}
      </p>

      {v.onBoard > 0 && (
        <section className={styles.boardHead}>
          <span className={styles.boardCount}>{v.onBoard} on the board</span>
          <Button variant="ghost" size="sm" onClick={v.clear}>
            Clear
          </Button>
        </section>
      )}

      <div className={styles.board}>
        {v.orphanHeld.length > 0 && (
          <section className={styles.set}>
            <div className={styles.grid}>
              {v.orphanHeld.map((h) => heldSquare(h.key))}
            </div>
          </section>
        )}

        {v.sets.map((set, index) => (
          <section key={set.batchKey} className={styles.set}>
            <header className={styles.setHead}>
              <span className={styles.setLabel}>
                Set {index + 1} &middot; {set.cast.length}
              </span>
            </header>
            <div className={styles.grid}>
              {set.cast.map(renderTile)}
              {set.held
                .filter((h) => !h.parentKey)
                .map((h) => heldSquare(h.key))}
            </div>
            {(set.more.length > 0 || set.held.some((h) => h.parentKey)) && (
              <>
                {/* Everything asked for *about* this set, under it: a `+` is a
                    follow-up question about one of these faces, not a new
                    press, and putting it inline would move the faces being
                    compared. */}
                <span className={styles.moreLabel}>
                  More from this set &middot; {set.more.length}
                </span>
                <div className={styles.grid}>
                  {set.more.map(renderTile)}
                  {set.held
                    .filter((h) => h.parentKey)
                    .map((h) => heldSquare(h.key))}
                </div>
              </>
            )}
          </section>
        ))}
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
