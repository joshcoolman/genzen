import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface EditChild {
  id: string
  url: string
}

export type EditChildrenMap = Record<string, Array<EditChild>>

export function useEditChildren(
  parentIds: Array<string>,
  userId: string | undefined,
): { map: EditChildrenMap; refresh: () => void } {
  const [childrenMap, setChildrenMap] = useState<EditChildrenMap>({})
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    if (!userId || parentIds.length === 0) return

    async function fetchChildren() {
      const { data } = await supabase
        .from('user_images')
        .select('id, storage_path, generation_metadata')
        .eq('user_id', userId!)
        .eq('status', 'completed')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (!data) return

      // Build a map of all child images (edits, variations, etc.) by source_image_id
      const allEdits = data.filter((row) => {
        const meta = row.generation_metadata as Record<string, unknown> | null
        return typeof meta?.source_image_id === 'string'
      })

      if (allEdits.length === 0) {
        setChildrenMap({})
        return
      }

      // Walk the tree: find all descendants of each parent ID
      const childrenOf = new Map<string, typeof allEdits>()
      for (const row of allEdits) {
        const meta = row.generation_metadata as Record<string, unknown>
        const srcId = meta.source_image_id as string
        const siblings = childrenOf.get(srcId) ?? []
        siblings.push(row)
        childrenOf.set(srcId, siblings)
      }

      // Build index for recency ordering (data is already sorted created_at desc)
      const recencyIndex = new Map<string, number>()
      data.forEach((row, i) => recencyIndex.set(row.id, i))

      // BFS to collect all descendants for each root parent, then sort newest-first
      const grouped: Record<string, Array<{ id: string; path: string }>> = {}
      for (const rootId of parentIds) {
        const descendants: Array<{ id: string; path: string }> = []
        const queue = [rootId]
        const visited = new Set<string>()
        while (queue.length > 0) {
          const current = queue.shift()!
          for (const row of childrenOf.get(current) ?? []) {
            if (visited.has(row.id)) continue
            visited.add(row.id)
            if (row.storage_path) {
              descendants.push({ id: row.id, path: row.storage_path })
            }
            queue.push(row.id)
          }
        }
        if (descendants.length > 0) {
          // Sort by recency (lower index = newer) and take top 8
          descendants.sort(
            (a, b) =>
              (recencyIndex.get(a.id) ?? 999) - (recencyIndex.get(b.id) ?? 999),
          )
          grouped[rootId] = descendants
        }
      }

      // Get signed URLs
      const result: EditChildrenMap = {}
      await Promise.all(
        Object.entries(grouped).map(async ([parentId, children]) => {
          const urls = await Promise.all(
            children.map(async (child) => {
              const { data: signed } = await supabase.storage
                .from('user-images')
                .createSignedUrl(child.path, 86400, {
                  transform: { width: 400, quality: 80 },
                })
              if (!signed?.signedUrl) return null
              return { id: child.id, url: signed.signedUrl }
            }),
          )
          result[parentId] = urls.filter((u): u is EditChild => u !== null)
        }),
      )

      setChildrenMap(result)
    }

    void fetchChildren()
  }, [userId, parentIds.join(','), refreshKey])

  // Realtime updates for new edit children
  useEffect(() => {
    if (!userId || parentIds.length === 0) return

    const channel = supabase
      .channel('edit_children_realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_images',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as {
            id: string
            status: string
            storage_path: string | null
            generation_metadata: Record<string, unknown> | null
          }
          if (updated.status !== 'completed' || !updated.storage_path) return
          const meta = updated.generation_metadata
          if (typeof meta?.source_image_id !== 'string') return
          const parentId = meta.source_image_id as string | undefined
          if (!parentId) return
          // Check if this edit belongs to any root parent's descendant tree
          // For realtime, check if the parent is either a root or already a known child
          const isDescendant =
            parentIds.includes(parentId) ||
            Object.values(childrenMap).some((children) =>
              children.some((c) => c.id === parentId),
            )
          if (!isDescendant) return

          // Find the root parent this descendant belongs to
          const rootParent =
            parentIds.find((rootId) => rootId === parentId) ??
            parentIds.find((rootId) =>
              (childrenMap[rootId] ?? []).some((c) => c.id === parentId),
            )
          if (!rootParent) return

          supabase.storage
            .from('user-images')
            .createSignedUrl(updated.storage_path, 86400, {
              transform: { width: 400, quality: 80 },
            })
            .then(({ data }) => {
              if (!data?.signedUrl) return
              setChildrenMap((prev) => {
                const existing = prev[rootParent] ?? []
                if (existing.some((c) => c.id === updated.id)) return prev
                return {
                  ...prev,
                  [rootParent]: [
                    { id: updated.id, url: data.signedUrl },
                    ...existing,
                  ],
                }
              })
            })
            .catch(() => {})
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, parentIds.join(',')])

  return { map: childrenMap, refresh }
}
