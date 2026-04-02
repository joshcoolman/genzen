import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/server/auth.server'

interface ReparentInput {
  accessToken: string
  imageId: string
  action: 'adopt' | 'detach'
  newParentId?: string
}

export const reparentImage = createServerFn({ method: 'POST' })
  .inputValidator((data: ReparentInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken)

    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      },
    )

    // Fetch all user images to build the tree
    const { data: allImages, error: fetchError } = await supabase
      .from('user_images')
      .select('id, generation_metadata')
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (fetchError) throw new Error(fetchError.message)

    type Row = {
      id: string
      generation_metadata: Record<string, unknown> | null
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    const rows = (allImages ?? []) as Array<Row>

    // Build parent->children map using parent_id (mutable grouping)
    const childrenOf = new Map<string, Array<Row>>()
    for (const row of rows) {
      const parentId = row.generation_metadata?.parent_id as string | undefined
      if (parentId) {
        const siblings = childrenOf.get(parentId) ?? []
        siblings.push(row)
        childrenOf.set(parentId, siblings)
      }
    }

    // BFS to collect all descendants of a given id
    function getDescendants(rootId: string): Set<string> {
      const descendants = new Set<string>()
      const queue = [rootId]
      while (queue.length > 0) {
        const current = queue.shift()!
        for (const child of childrenOf.get(current) ?? []) {
          if (!descendants.has(child.id)) {
            descendants.add(child.id)
            queue.push(child.id)
          }
        }
      }
      return descendants
    }

    const targetRow = rows.find((r) => r.id === data.imageId)
    if (!targetRow) throw new Error('Image not found')

    if (data.action === 'adopt') {
      if (!data.newParentId) throw new Error('newParentId required for adopt')

      const parentRow = rows.find((r) => r.id === data.newParentId)
      if (!parentRow) throw new Error('Parent image not found')

      // Cycle check: newParentId must not be a descendant of imageId
      const descendants = getDescendants(data.imageId)
      if (descendants.has(data.newParentId)) {
        throw new Error('Cannot adopt under own descendant')
      }

      // Find root of the new parent by walking ancestry
      let newRootId = data.newParentId
      const rowMap = new Map(rows.map((r) => [r.id, r]))
      const visited = new Set<string>()
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        visited.add(newRootId)
        const current = rowMap.get(newRootId)
        const parentId = current?.generation_metadata?.source_image_id as
          | string
          | undefined
        if (!parentId || visited.has(parentId)) break
        newRootId = parentId
      }

      // Update imageId: set parent_id to newParentId (organizational parent)
      // NOTE: source_image_id remains immutable - it's the true generation source
      const existingType = targetRow.generation_metadata?.generation_type as
        | string
        | undefined
      const needsType = existingType !== 'edit' && existingType !== 'variation'
      const targetMeta = {
        ...(targetRow.generation_metadata ?? {}),
        parent_id: data.newParentId, // Set group parent (mutable)
        ...(needsType ? { generation_type: 'variation' } : {}),
      }
      const { error: updateError } = await supabase
        .from('user_images')
        .update({ generation_metadata: targetMeta })
        .eq('id', data.imageId)
        .eq('user_id', user.id)

      if (updateError) throw new Error(updateError.message)

      // Bump the new parent's sort_order so it floats to top of grid
      const newSortOrder = Date.now() / 1000
      await supabase
        .from('user_images')
        .update({ sort_order: newSortOrder })
        .eq('id', data.newParentId)
        .eq('user_id', user.id)

      // Update root_image_id for imageId + all descendants
      // For the target image, use targetMeta (which already has source_image_id)
      const idsToUpdate = [data.imageId, ...descendants]
      await Promise.all(
        idsToUpdate.map(async (id) => {
          const baseMeta =
            id === data.imageId
              ? targetMeta
              : (rowMap.get(id)?.generation_metadata ?? {})
          const meta = {
            ...baseMeta,
            root_image_id: newRootId,
          }
          const { error } = await supabase
            .from('user_images')
            .update({ generation_metadata: meta })
            .eq('id', id)
            .eq('user_id', user.id)
          if (error) throw new Error(error.message)
        }),
      )
    } else {
      // Detach flow
      const descendants = getDescendants(data.imageId)
      const rowMap = new Map(rows.map((r) => [r.id, r]))

      // Update imageId: remove parent_id and generation_type
      // NOTE: source_image_id remains immutable - preserves true generation history
      const targetMeta = { ...(targetRow.generation_metadata ?? {}) }
      delete targetMeta.parent_id // Remove from group (mutable)
      delete targetMeta.generation_type
      const { error: updateError } = await supabase
        .from('user_images')
        .update({ generation_metadata: targetMeta })
        .eq('id', data.imageId)
        .eq('user_id', user.id)

      if (updateError) throw new Error(updateError.message)

      // Update root_image_id for imageId + all descendants to imageId
      // For the target image, use targetMeta (which already has source_image_id/generation_type removed)
      const idsToUpdate = [data.imageId, ...descendants]
      await Promise.all(
        idsToUpdate.map(async (id) => {
          const baseMeta =
            id === data.imageId
              ? targetMeta
              : (rowMap.get(id)?.generation_metadata ?? {})
          const meta = {
            ...baseMeta,
            root_image_id: data.imageId,
          }
          const { error } = await supabase
            .from('user_images')
            .update({ generation_metadata: meta })
            .eq('id', id)
            .eq('user_id', user.id)
          if (error) throw new Error(error.message)
        }),
      )
    }
  })
