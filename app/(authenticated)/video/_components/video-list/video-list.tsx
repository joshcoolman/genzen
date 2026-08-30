'use client'

import { VideoGroupCard } from '../video-group-card/video-group-card'
import { VideoThumb } from '../video-thumb/video-thumb'
import styles from './video-list.module.css'
import type { VideoRecord } from '../../_actions/generate-video.action'
import type { ImageGroupSummary } from '#/features/groups/hooks/use-groups'
import { EmptyState } from '#/components'

/** One cell of the wall: a clip, or a group standing in for several (#517). */
export type VideoCell = { key: string } & (
  | { kind: 'clip'; video: VideoRecord }
  | { kind: 'group'; group: ImageGroupSummary }
)

/**
 * The wall: clips and group cards in one order, newest first.
 *
 * The grid and nothing else. A clip is `VideoThumb` and a group is
 * `VideoGroupCard`, each owning its own anatomy -- a list is a layout, a card
 * is a record, and only the second of those has a scale to keep.
 *
 * The two cell kinds are ordered together by the hook, not stacked in blocks,
 * so a group sorts among the clips by the same clock they do.
 */
export function VideoList({
  cells,
  isInGroup,
  onDelete,
  onHide,
  onContinue,
  playingId,
  onPlay,
  continuingId,
  selectedIds,
  onSelect,
  onOpenGroup,
  onRenameGroup,
  onDissolveGroup,
  onTrashGroup,
  expandedGroupIds,
  groupMembers,
  onToggleGroupMembers,
  workingByGroup,
}: {
  cells: Array<VideoCell>
  /** Inside a group the empty state says something different -- the wall is
   *  not empty, this group is. */
  isInGroup: boolean
  onDelete: (id: string) => void
  /** Take a clip off the wall without destroying it (#537). Straight through
   *  to the card's corner icon. */
  onHide: (id: string) => void
  onContinue: (video: VideoRecord) => void
  /** The one clip holding playback, if any. Lifted here so that starting a
   *  second clip stops the first (#530). */
  playingId: string | null
  onPlay: (id: string) => void
  /** The clip whose last frame is being read, if any -- one at a time. */
  continuingId: string | null
  /** The clips picked for a bulk action (#517). Passed as the set rather than
   *  a per-card boolean so the list can also tell each card whether *anything*
   *  is picked, which is what greys the unpicked borders. */
  selectedIds: Set<string>
  onSelect: (id: string, shiftKey: boolean) => void
  onOpenGroup: (group: ImageGroupSummary) => void
  onRenameGroup: (group: ImageGroupSummary) => void
  onDissolveGroup: (group: ImageGroupSummary) => void
  onTrashGroup: (group: ImageGroupSummary) => void
  expandedGroupIds: Set<string>
  groupMembers: Record<string, Array<string>>
  onToggleGroupMembers: (groupId: string) => void
  workingByGroup: Record<string, number>
}) {
  if (cells.length === 0) {
    return isInGroup ? (
      <EmptyState title="Nothing in this group yet">
        Generate while you are in here and the clip is filed as it lands.
      </EmptyState>
    ) : (
      <EmptyState title="No clips yet">
        Say what should happen, and generate. A first frame is optional.
      </EmptyState>
    )
  }

  return (
    <div className={styles.list}>
      {cells.map((cell) =>
        cell.kind === 'group' ? (
          <VideoGroupCard
            key={cell.key}
            group={cell.group}
            expanded={expandedGroupIds.has(cell.group.id)}
            members={groupMembers[cell.group.id]}
            onOpen={onOpenGroup}
            onRename={onRenameGroup}
            onDissolve={onDissolveGroup}
            onTrash={onTrashGroup}
            /* Absent with nothing to disclose, which leaves the row a plain
               div rather than a dead button. */
            onToggleMembers={
              cell.group.count > 0
                ? () => onToggleGroupMembers(cell.group.id)
                : undefined
            }
            working={workingByGroup[cell.group.id] ?? 0}
          />
        ) : (
          <VideoThumb
            key={cell.key}
            video={cell.video}
            isPlaying={playingId === cell.video.id}
            onPlay={onPlay}
            onDelete={onDelete}
            onHide={onHide}
            onContinue={onContinue}
            isContinuing={continuingId === cell.video.id}
            selected={selectedIds.has(cell.video.id)}
            selectionActive={selectedIds.size > 0}
            onSelect={onSelect}
          />
        ),
      )}
    </div>
  )
}
