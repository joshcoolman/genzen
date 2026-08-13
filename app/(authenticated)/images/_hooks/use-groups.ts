'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  addImagesToGroup,
  createImageGroup,
  dissolveImageGroup,
  listImageGroups,
  removeImagesFromGroup,
  renameImageGroup,
  setGroupCover,
  trashImageGroup,
} from '../_actions/groups.action'
import type { ImageGroupSummary } from '../_actions/groups.action'
import { toast } from '#/components'

/**
 * The group list, and every write against it (#319).
 *
 * Server-truth on every mutation rather than an optimistic local edit: a write
 * changes a group's cover, its count, its preview strip and its position in the
 * grid at once, and reproducing that arithmetic client-side is four chances to
 * disagree with the database over a saving nobody would notice.
 *
 * The gallery's own refresh is the caller's job -- membership lives on the
 * image row, so both lists move together and only the caller knows both.
 */
export function useGroups() {
  const [groups, setGroups] = useState<Array<ImageGroupSummary>>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setGroups(await listImageGroups())
    } catch (err) {
      console.error('[groups] could not load', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  /** Wraps a write so a failure says so rather than looking like a no-op --
   *  the grid after a silently failed group write is the grid before it. */
  const write = useCallback(
    async (fn: () => Promise<void>, whenFailed: string) => {
      try {
        await fn()
        await refresh()
        return true
      } catch (err) {
        toast(err instanceof Error ? err.message : whenFailed)
        return false
      }
    },
    [refresh],
  )

  const create = useCallback(
    async (name: string, imageIds: Array<string>) => {
      try {
        const { id } = await createImageGroup(name, imageIds)
        await refresh()
        return id
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Could not create the group')
        return null
      }
    },
    [refresh],
  )

  const addTo = useCallback(
    (groupId: string, imageIds: Array<string>) =>
      write(
        () => addImagesToGroup(groupId, imageIds),
        'Could not add to the group',
      ),
    [write],
  )

  const removeFrom = useCallback(
    (imageIds: Array<string>) =>
      write(
        () => removeImagesFromGroup(imageIds),
        'Could not remove from the group',
      ),
    [write],
  )

  const rename = useCallback(
    (groupId: string, name: string) =>
      write(() => renameImageGroup(groupId, name), 'Could not rename'),
    [write],
  )

  const dissolve = useCallback(
    (groupId: string) =>
      write(() => dissolveImageGroup(groupId), 'Could not dissolve the group'),
    [write],
  )

  /** The card's delete icon. Asks first -- it is the only group action that
   *  touches pictures -- and then trashes them, so Trash is the way back. */
  const trash = useCallback(
    (groupId: string) =>
      write(() => trashImageGroup(groupId), 'Could not trash the group'),
    [write],
  )

  const setCover = useCallback(
    (groupId: string, imageId: string) =>
      write(
        () => setGroupCover(groupId, imageId),
        'Could not set the cover image',
      ),
    [write],
  )

  return {
    groups,
    loading,
    refresh,
    create,
    addTo,
    removeFrom,
    rename,
    dissolve,
    trash,
    setCover,
  }
}

export type GroupsState = ReturnType<typeof useGroups>
export type { ImageGroupSummary }
