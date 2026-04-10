import { useMemo } from 'react'
import { VideoCard } from './VideoCard'
import type { SavedAiVideo } from '../video-types'

const GRID_MIN_WIDTH: Record<string, string> = {
  lg: '200px',
  md: '120px',
  sm: '80px',
}

interface VideoGalleryProps {
  videos: Array<SavedAiVideo>
  thumbnailUrls: Record<string, string>
  loadingGallery: boolean
  thumbSize?: 'lg' | 'md' | 'sm'
  showInfo?: boolean
  /** Optional list of video ids that are considered "in scope". When set,
   *  videos outside the scope are filtered out. Used by edit view to show
   *  only the current group. */
  scopedIds?: Set<string>
  /** When set, this is the currently highlighted video (edit view). */
  activeId?: string
  /** When true, delete button is shown on cards. */
  allowDelete?: boolean
  onOpen?: (video: SavedAiVideo) => void
  onDelete?: (video: SavedAiVideo) => void
  selectionActive?: boolean
  isSelected?: (id: string) => boolean
  onSelect?: (id: string, shiftKey: boolean) => void
}

export function VideoGallery({
  videos,
  thumbnailUrls,
  loadingGallery,
  thumbSize = 'lg',
  showInfo = true,
  scopedIds,
  activeId,
  allowDelete = true,
  onOpen,
  onDelete,
  selectionActive,
  isSelected,
  onSelect,
}: VideoGalleryProps) {
  // Edit view ("flat mode") shows every video in the current group as its own
  // equal-sized card with no nested children. Main view uses parent-anchor
  // grouping with nested thumbs under each parent card.
  const flatMode = scopedIds !== undefined

  const { topLevelVideos, childrenByParent, childIds } = useMemo(() => {
    const scope = scopedIds ? videos.filter((v) => scopedIds.has(v.id)) : videos

    if (flatMode) {
      // Flat: every scoped video is rendered as a top-level card, newest first.
      const sorted = [...scope].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      )
      return {
        topLevelVideos: sorted,
        childrenByParent: new Map<string, Array<SavedAiVideo>>(),
        childIds: new Set<string>(),
      }
    }

    // Main view: build parent -> children map for nested display.
    const byParent = new Map<string, Array<SavedAiVideo>>()
    for (const v of scope) {
      const pid = v.generation_metadata?.parent_id
      if (pid) {
        const existing = byParent.get(pid) ?? []
        existing.push(v)
        byParent.set(pid, existing)
      }
    }

    // Sort each group's children by creation date desc (newest first)
    for (const arr of byParent.values()) {
      arr.sort((a, b) => b.created_at.localeCompare(a.created_at))
    }

    // Top-level = videos without a parent_id (or whose parent_id is not in scope)
    const allIds = new Set(scope.map((v) => v.id))
    const topLevel = scope.filter((v) => {
      const pid = v.generation_metadata?.parent_id
      return !pid || !allIds.has(pid)
    })

    // Child IDs set — these are rendered as nested thumbs under their parents,
    // so we skip them in the top-level loop.
    const cIds = new Set<string>()
    for (const [parentId, children] of byParent.entries()) {
      if (allIds.has(parentId)) {
        for (const c of children) cIds.add(c.id)
      }
    }

    return {
      topLevelVideos: topLevel,
      childrenByParent: byParent,
      childIds: cIds,
    }
  }, [videos, scopedIds, flatMode])

  if (loadingGallery) {
    return (
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_MIN_WIDTH[thumbSize]}, 1fr))`,
        }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-video rounded-md bg-muted/30 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (topLevelVideos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          No videos yet
        </h3>
        <p className="text-sm text-muted-foreground">
          Fill in the sidebar and hit Generate to create your first video.
        </p>
      </div>
    )
  }

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_MIN_WIDTH[thumbSize]}, 1fr))`,
      }}
    >
      {topLevelVideos.map((video) => {
        // Skip videos that are nested as children on another parent card
        if (childIds.has(video.id)) return null

        const children = (childrenByParent.get(video.id) ?? [])
          .slice(0, 8)
          .map((c) => ({
            video: c,
            thumbnailUrl: thumbnailUrls[c.id] ?? null,
          }))

        return (
          <VideoCard
            key={video.id}
            video={video}
            thumbnailUrl={thumbnailUrls[video.id] ?? null}
            children={children}
            showInfo={showInfo}
            active={activeId === video.id}
            selected={isSelected?.(video.id) ?? false}
            selectionActive={selectionActive}
            onOpen={onOpen}
            onSelect={onSelect}
            onDelete={allowDelete ? onDelete : undefined}
          />
        )
      })}
    </div>
  )
}
