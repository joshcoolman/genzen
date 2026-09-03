'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PEOPLE_MODELS, defaultModelId, quickModelId } from './models'
import {
  bySet,
  childCount,
  insertTiles,
  lastBatchKey,
  readBoard,
  writeBoard,
} from './board'
import { writeCast, writeMoreLike } from './_actions/write-cast.action'
import { submitPerson } from './_actions/submit-person.action'
import type { Tile } from './board'
import type { PeopleModel } from './models'
import { estimateImageCostCents } from '#/features/ai-images/models'
import { useGenerationPoll } from '#/features/ai-images/hooks/use-generation-poll'
import { deleteGalleryImage } from '#/features/ai-images/server/gallery.action'
import { useUserImages } from '#/features/user-images/hooks/use-user-images'
import { useAuth } from '#/lib/auth'
import { toast } from '#/components'

/** How many `+` gives you, with no dialog and no choice. */
const QUICK_COUNT = 1

/**
 * A square pressed but not yet submitted -- the writer is still answering, or
 * the row is being reserved. It exists so a click puts something on the board
 * in the same frame.
 */
export interface HeldTile {
  key: string
  batchKey: string
  parentKey: string | null
}

export function useView() {
  const { user } = useAuth()
  const library = useUserImages(user.id)

  const [count, setCount] = useState(1)
  const [modelIds, setModelIds] = useState<Array<string>>(() => [
    defaultModelId(),
  ])
  const [tiles, setTiles] = useState<Array<Tile>>([])
  const [held, setHeld] = useState<Array<HeldTile>>([])
  const [error, setError] = useState<string | null>(null)

  // localStorage, so it is read after mount rather than during a server render.
  useEffect(() => setTiles(readBoard()), [])

  const update = useCallback((next: (current: Array<Tile>) => Array<Tile>) => {
    setTiles((current) => {
      const value = next(current)
      writeBoard(value)
      return value
    })
  }, [])

  const rows = useMemo(
    () => new Map(library.images.map((image) => [image.id, image])),
    [library.images],
  )

  /**
   * The board, with each tile's picture attached. A tile whose row the library
   * no longer has is dropped rather than drawn as a hole -- which is what lets
   * discard be the gallery's own delete and nothing more.
   */
  const sets = useMemo(() => {
    const withRow = (tile: Tile) => {
      const row = rows.get(tile.recordId)!
      return {
        ...tile,
        status: row.status,
        failure: row.generation_error,
        url: library.imageUrls[tile.recordId] ?? null,
        model: row.title,
        spawned: childCount(tiles, tile.recordId),
      }
    }

    return bySet(tiles.filter((t) => rows.has(t.recordId))).map((set) => ({
      ...set,
      cast: set.cast.map(withRow),
      more: set.more.map(withRow),
      held: held.filter((h) => h.batchKey === set.batchKey),
    }))
  }, [tiles, rows, held, library.imageUrls])

  /** Held squares whose set has no rows yet -- the first press, where every
   *  tile is still being written. */
  const orphanHeld = useMemo(() => {
    const known = new Set(sets.map((s) => s.batchKey))
    return held.filter((h) => !known.has(h.batchKey))
  }, [sets, held])

  /** The oldest row still generating, which is what the poll backs off from.
   *  Every tile here is an ordinary generation, so this is the ordinary poll. */
  const pendingSince = useMemo(
    () =>
      tiles
        .map((t) => rows.get(t.recordId))
        .filter((row) => row?.status === 'pending')
        .map((row) => row!.created_at)
        .sort()
        .at(0) ?? null,
    [tiles, rows],
  )

  useGenerationPoll(pendingSince, library.refresh)

  const toggleModel = useCallback((id: string) => {
    setModelIds((current) =>
      current.includes(id)
        ? current.filter((m) => m !== id)
        : // Kept in lineup order rather than click order, so the tiles a press
          // adds are always grouped the same way.
          PEOPLE_MODELS.filter(
            (m) => current.includes(m.id) || m.id === id,
          ).map((m) => m.id),
    )
  }, [])

  /**
   * Put squares on the board *before* asking who is in them.
   *
   * The writer takes a second or two and the submit a moment more, so a press
   * that waited for both showed nothing for the length of the slowest step --
   * three `+` presses in a row looked like three clicks into a void. Reserved
   * squares are the difference between a page you can jam on and one you poke
   * at: the count is right immediately and the faces fill in underneath.
   */
  const hold = useCallback(
    (howMany: number, batchKey: string, parentKey: string | null) => {
      const squares = Array.from({ length: howMany }, () => ({
        key: crypto.randomUUID(),
        batchKey,
        parentKey,
      }))
      setHeld((current) => [...current, ...squares])
      return squares
    },
    [],
  )

  const release = useCallback((squares: Array<HeldTile>) => {
    const keys = new Set(squares.map((s) => s.key))
    setHeld((current) => current.filter((h) => !keys.has(h.key)))
  }, [])

  /**
   * Submit one generation per person per model, releasing each held square as
   * its row arrives so the count never shows a face twice.
   */
  const submitAll = useCallback(
    async (
      specs: Array<string>,
      models: Array<PeopleModel>,
      into: { batchKey: string; parentKey?: string },
      squares: Array<HeldTile>,
    ) => {
      const queue = [...squares]
      await Promise.all(
        specs.flatMap((spec) =>
          models.map(async (m) => {
            const square = queue.shift()
            try {
              const { recordId } = await submitPerson({ spec, modelId: m.id })
              update((current) =>
                insertTiles(
                  current,
                  [
                    {
                      recordId,
                      batchKey: into.batchKey,
                      spec,
                      parentKey: into.parentKey ?? null,
                    },
                  ],
                  into.parentKey,
                ),
              )
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : 'That one did not start',
              )
            } finally {
              if (square) release([square])
            }
          }),
        ),
      )
      // A writer that came back short leaves squares nobody will fill.
      release(queue)
      await library.refresh()
    },
    [library, release, update],
  )

  const models = useMemo(
    () => PEOPLE_MODELS.filter((m) => modelIds.includes(m.id)),
    [modelIds],
  )

  /**
   * A press.
   *
   * **One at a time is the default, and pressing it repeatedly is the point.**
   * Ten in one go writes a cast that spreads by construction; one at a time is
   * how the page is actually used -- press, look, press again -- and the
   * variety then has to come from somewhere, because ten independent presses of
   * one prompt is exactly the case that returned the same man ten times. So
   * every press hands the writer the people already on the board and asks for
   * someone unlike all of them. The board is the history.
   *
   * **A single press joins the set above it; a batch opens a new one.** Nobody
   * wants a rule drawn between every face while jamming on the button, and a
   * deliberate cast of ten is a block to judge whole.
   */
  const generate = useCallback(async () => {
    if (models.length === 0 || count < 1) return
    setError(null)

    const joining = count === 1 ? lastBatchKey(tiles) : null
    const batchKey = joining ?? crypto.randomUUID()
    const squares = hold(count * models.length, batchKey, null)
    try {
      const specs = await writeCast({
        count,
        avoid: tiles.map((t) => t.spec),
      })
      await submitAll(specs, models, { batchKey }, squares)
    } catch (err) {
      release(squares)
      setError(err instanceof Error ? err.message : 'That failed')
    }
  }, [count, hold, models, release, submitAll, tiles])

  /**
   * More people from one face's bucket.
   *
   * **Haiku writes them, not Sonnet.** The cast is the hard call; this is one
   * bucket and a couple of faces, sitting behind a button pressed three times
   * in a row.
   *
   * It briefly wrote nothing at all -- the parent's spec was reused with a
   * clause asking for someone else from that bucket, which was instant and came
   * back too alike, because a paragraph naming a mole and a jawline is a
   * description of a person however it is framed.
   *
   * Nothing is locked while it thinks: three rapid presses are three
   * independent asks, and a button that greys out while the first one works is
   * the opposite of what this page is for.
   */
  const moreLike = useCallback(
    async (
      tile: Tile,
      options?: { count?: number; modelIds?: Array<string> },
    ) => {
      if (!tile.spec) return
      const wanted = options?.count ?? QUICK_COUNT
      const on = options?.modelIds
        ? PEOPLE_MODELS.filter((m) => options.modelIds!.includes(m.id))
        : PEOPLE_MODELS.filter((m) => m.id === quickModelId())
      if (on.length === 0 || wanted < 1) return

      setError(null)
      const squares = hold(wanted * on.length, tile.batchKey, tile.recordId)
      try {
        const specs = await writeMoreLike({ spec: tile.spec, count: wanted })
        await submitAll(
          specs,
          on,
          { batchKey: tile.batchKey, parentKey: tile.recordId },
          squares,
        )
      } catch (err) {
        release(squares)
        setError(err instanceof Error ? err.message : 'That failed')
      }
    },
    [hold, release, submitAll],
  )

  /**
   * Discard is the gallery's own delete: a finished face soft-deletes into
   * Trash, a failed or still-generating one goes outright. The tile leaves with
   * the row it names, so nothing here remembers what was removed.
   */
  const discard = useCallback(
    async (recordId: string) => {
      update((current) => current.filter((t) => t.recordId !== recordId))
      try {
        await deleteGalleryImage(recordId)
      } catch {
        toast.error('Could not delete that one')
      }
      await library.refresh()
    },
    [library, update],
  )

  /** Clear empties the board and leaves the pictures alone: they are in Images
   *  now, so tidying a working surface is not a delete. */
  const clear = useCallback(() => update(() => []), [update])

  const estimate = useMemo(
    () => estimateImageCostCents(modelIds, count, false),
    [modelIds, count],
  )

  return {
    count,
    setCount,
    models: PEOPLE_MODELS,
    modelIds,
    toggleModel,
    sets,
    orphanHeld,
    onBoard: tiles.length + held.length,
    error,
    estimate,
    canGenerate: modelIds.length > 0 && count >= 1,
    generate,
    moreLike,
    discard,
    clear,
  }
}
