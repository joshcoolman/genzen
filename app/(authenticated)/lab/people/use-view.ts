'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PEOPLE_MODELS, defaultModelId, quickModelId } from './models'
import {
  childCount,
  insertTiles,
  newTile,
  readBoard,
  writeBoard,
} from './board'
import { writeCast, writeMoreLike } from './_actions/write-cast.action'
import { renderPerson } from './_actions/render-person.action'
import { keepPerson } from './_actions/keep-person.action'
import type { Tile } from './board'
import type { PeopleModel } from './models'
import { estimateImageCostCents } from '#/features/ai-images/models'

/** How many `+` gives you, with no dialog and no choice. */
const QUICK_COUNT = 1

export function useView() {
  const [count, setCount] = useState(10)
  const [modelIds, setModelIds] = useState<Array<string>>(() => [
    defaultModelId(),
  ])
  const [tiles, setTiles] = useState<Array<Tile>>([])
  const [isWriting, setIsWriting] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
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
   * Render one spec on one model and settle its tile. Every press is a fan-out
   * of these: they are independent calls, and a board of thirty rendered in
   * series would be a wait nobody sits through.
   */
  const render = useCallback(
    async (tile: Tile) => {
      try {
        const { url } = await renderPerson({
          spec: tile.spec,
          modelId: tile.modelId,
        })
        update((current) =>
          current.map((t) =>
            t.key === tile.key ? { ...t, status: 'done', url } : t,
          ),
        )
      } catch (err) {
        update((current) =>
          current.map((t) =>
            t.key === tile.key
              ? {
                  ...t,
                  status: 'failed',
                  error: err instanceof Error ? err.message : 'Failed',
                }
              : t,
          ),
        )
      }
    },
    [update],
  )

  const runSpecs = useCallback(
    (specs: Array<string>, models: Array<PeopleModel>, parentKey?: string) => {
      const added = specs.flatMap((spec) =>
        models.map((m) =>
          newTile({ spec, modelId: m.id, modelName: m.name, parentKey }),
        ),
      )
      update((current) => insertTiles(current, added, parentKey))
      void Promise.all(added.map(render))
    },
    [render, update],
  )

  const models = useMemo(
    () => PEOPLE_MODELS.filter((m) => modelIds.includes(m.id)),
    [modelIds],
  )

  /**
   * A press: one call writes the cast, then every person renders on every
   * model that is on. The number typed is always people -- a model toggle buys
   * a second opinion on the same person rather than more people.
   */
  const generate = useCallback(async () => {
    if (models.length === 0 || count < 1) return
    setIsWriting(true)
    setError(null)
    try {
      runSpecs(await writeCast({ count }), models)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The cast failed')
    } finally {
      setIsWriting(false)
    }
  }, [count, models, runSpecs])

  /** More people from one tile's bucket. `+` passes nothing and gets one on
   *  Grok; the dialog passes both and gets what it asked for. */
  const moreLike = useCallback(
    async (
      tile: Tile,
      options?: { count?: number; modelIds?: Array<string> },
    ) => {
      const wanted = options?.count ?? QUICK_COUNT
      const on = options?.modelIds
        ? PEOPLE_MODELS.filter((m) => options.modelIds!.includes(m.id))
        : PEOPLE_MODELS.filter((m) => m.id === quickModelId())
      if (on.length === 0 || wanted < 1) return

      setBusyKey(tile.key)
      setError(null)
      try {
        const specs = await writeMoreLike({ spec: tile.spec, count: wanted })
        runSpecs(specs, on, tile.key)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'That failed')
      } finally {
        setBusyKey(null)
      }
    },
    [runSpecs],
  )

  const keep = useCallback(
    async (tile: Tile) => {
      if (!tile.url || tile.keptImageId) return
      setBusyKey(tile.key)
      setError(null)
      try {
        const { imageId } = await keepPerson({
          url: tile.url,
          spec: tile.spec,
          modelId: tile.modelId,
        })
        update((current) =>
          current.map((t) =>
            t.key === tile.key ? { ...t, keptImageId: imageId } : t,
          ),
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Keep failed')
      } finally {
        setBusyKey(null)
      }
    },
    [update],
  )

  const discard = useCallback(
    (key: string) => update((current) => current.filter((t) => t.key !== key)),
    [update],
  )

  const clear = useCallback(() => update(() => []), [update])

  /** A url that 404s is an expired FAL result, not a broken page -- the tile
   *  says so rather than showing a torn image. */
  const markExpired = useCallback(
    (key: string) =>
      update((current) =>
        current.map((t) =>
          t.key === key && t.status === 'done'
            ? { ...t, status: 'expired', url: null }
            : t,
        ),
      ),
    [update],
  )

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
    tiles,
    childCount: useCallback((key: string) => childCount(tiles, key), [tiles]),
    isWriting,
    busyKey,
    error,
    estimate,
    canGenerate: modelIds.length > 0 && count >= 1 && !isWriting,
    generate,
    moreLike,
    keep,
    discard,
    clear,
    markExpired,
  }
}
