'use client'

import { useEffect, useState } from 'react'
import { listEditChildren } from '@/features/ai-images/server/edit.actions'
import { createImageStorage } from '@/lib/image-storage'

interface EditChild {
  id: string
  url: string
  storagePath: string
  thumbnailPath: string | null
}

export type EditChildrenMap = Record<string, Array<EditChild>>

/**
 * Nested thumbnails under a gallery card. No database access and no realtime:
 * the tree walk lives in `edit.actions.ts`, and the parent list is derived from
 * the gallery, so a newly completed child re-runs this the moment the gallery's
 * poll picks it up (#173, #174).
 */
export function useEditChildren(parentIds: Array<string>): {
  map: EditChildrenMap
  refresh: () => void
} {
  const [childrenMap, setChildrenMap] = useState<EditChildrenMap>({})
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    if (parentIds.length === 0) return
    // An object so the closure below reads the *current* value after each
    // await, not the one narrowed at capture time.
    const run = { cancelled: false }

    async function fetchChildren() {
      const grouped = await listEditChildren(parentIds).catch(() => null)
      if (!grouped || run.cancelled) return

      const result: EditChildrenMap = {}
      await Promise.all(
        Object.entries(grouped).map(async ([parentId, children]) => {
          const resolved = await Promise.all(
            children.map(async (child) => {
              const url = await createImageStorage().getUrl(
                child.thumbnailPath ?? child.storagePath,
              )
              if (!url) return null
              return { ...child, url }
            }),
          )
          result[parentId] = resolved.filter(
            (child): child is EditChild => child !== null,
          )
        }),
      )

      setChildrenMap(result)
    }

    void fetchChildren()
    return () => {
      run.cancelled = true
    }
  }, [parentIds.join(','), refreshKey])

  return { map: childrenMap, refresh }
}
