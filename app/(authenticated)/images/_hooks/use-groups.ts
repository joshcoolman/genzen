'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  addImagesToGroup,
  createImageGroup,
  dissolveImageGroup,
  listImageGroups,
  moveGroupContents,
  removeImagesFromGroup,
  renameImageGroup,
  setGroupCover,
  trashImageGroup,
} from '../_actions/groups.action'
import type { GroupWrite, ImageGroupSummary } from '../_actions/groups.action'
import { toast } from '#/components'

/**
 * The group list, and every write against it (#319).
 *
 * Still server-truth rather than optimistic arithmetic: a write changes a
 * group's cover, its count, its preview strip and its position in the grid at
 * once, and reproducing that client-side is four chances to disagree with the
 * database. What changed in #331 is where the truth comes from -- the write
 * *returns* it, so there is no `listImageGroups()` round trip behind every
 * mutation and the card moves in the same tick as the grid.
 *
 * A failed write re-reads. That is the one place a full list is still worth
 * buying: whatever the server has is what should be on screen, and this hook
 * guessing what its patch half-applied is how the two lists drift.
 *
 * The gallery's own half is the caller's job -- membership lives on the image
 * row, so each write returns to `use-view`, which owns both lists.
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

  /**
   * Patch the list from what the write returned.
   *
   * Upsert rather than replace-by-index: a create has no row to find, and an
   * add touches the group the images left as well as the one they joined.
   * Re-sorted every time because `sort_order` is the newest member's, so
   * filing one picture is enough to move a card across the grid.
   */
  const apply = useCallback((write: GroupWrite) => {
    setGroups((prev) => {
      const gone = new Set(write.gone)
      const next = prev.filter((g) => !gone.has(g.id))
      for (const group of write.groups) {
        const at = next.findIndex((g) => g.id === group.id)
        if (at >= 0) next[at] = group
        else next.push(group)
      }
      return next.sort((a, b) => b.sort_order - a.sort_order)
    })
  }, [])

  /**
   * Wraps a write so a failure says so rather than looking like a no-op -- the
   * grid after a silently failed group write is the grid before it. Returns
   * the write for the caller's half of the patch, or null when it failed.
   */
  const write = useCallback(
    async (fn: () => Promise<GroupWrite>, whenFailed: string) => {
      try {
        const result = await fn()
        apply(result)
        return result
      } catch (err) {
        toast(err instanceof Error ? err.message : whenFailed)
        await refresh()
        return null
      }
    },
    [apply, refresh],
  )

  const create = useCallback(
    (name: string, imageIds: Array<string>) =>
      write(
        () => createImageGroup(name, imageIds),
        'Could not create the group',
      ),
    [write],
  )

  const addTo = useCallback(
    (groupId: string, imageIds: Array<string>) =>
      write(
        () => addImagesToGroup(groupId, imageIds),
        'Could not add to the group',
      ),
    [write],
  )

  /** The card's Move to group: every picture goes to the destination and the
   *  source group is gone. One write, because membership is a column (#350). */
  const moveContents = useCallback(
    (sourceGroupId: string, targetGroupId: string) =>
      write(
        () => moveGroupContents(sourceGroupId, targetGroupId),
        'Could not move the group',
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
    moveContents,
    removeFrom,
    rename,
    dissolve,
    trash,
    setCover,
  }
}

export type GroupsState = ReturnType<typeof useGroups>
export type { GroupWrite, ImageGroupSummary }
