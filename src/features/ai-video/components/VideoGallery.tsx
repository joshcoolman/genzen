import { VideoCard } from './VideoCard'
import { GenerationChain } from './GenerationChain'
import type { FirstFrameGroup } from '../hooks/use-generations'
import type { Generation } from '../types'
import { ImageGrid } from '@/components/ImageGrid'

interface VideoGalleryProps {
  groups: Array<FirstFrameGroup>
  thumbSize: 'lg' | 'md' | 'sm'
  showInfo: boolean
  activeFirstFrameId: string | null
  onActivate: (firstFrameId: string) => void
  onDeactivate: () => void
  selectionActive: boolean
  isSelected: (firstFrameId: string) => boolean
  onSelect: (firstFrameId: string, shiftKey: boolean) => void
  onLoad: (gen: Generation) => void
  onContinue: (gen: Generation) => void
  onDelete: (id: string) => void
  onDeleteGroup: (generationIds: Array<string>) => void
  onGenerateVideo?: (gen: Generation) => void
  accessToken: string | undefined
}

export function VideoGallery({
  groups,
  thumbSize,
  showInfo,
  activeFirstFrameId,
  onActivate,
  onDeactivate,
  selectionActive,
  isSelected,
  onSelect,
  onLoad,
  onContinue,
  onDelete,
  onDeleteGroup,
  onGenerateVideo,
  accessToken,
}: VideoGalleryProps) {
  const activeGroup = activeFirstFrameId
    ? groups.find((g) => g.firstFrameId === activeFirstFrameId)
    : null

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 flex items-center justify-center">
        <p className="text-xs text-muted-foreground">
          Generated videos will appear here
        </p>
      </div>
    )
  }

  // Detail view: hide gallery, show focused generation chain
  if (activeGroup) {
    return (
      <GenerationChain
        generations={activeGroup.generations}
        firstFrameUrl={activeGroup.firstFrameUrl}
        onBack={onDeactivate}
        onLoad={onLoad}
        onContinue={onContinue}
        onDelete={onDelete}
        onGenerateVideo={onGenerateVideo}
        accessToken={accessToken}
      />
    )
  }

  // Gallery view: grid of first frame cards
  return (
    <ImageGrid size={thumbSize}>
      {groups.map((group) => (
        <VideoCard
          key={group.firstFrameId}
          group={group}
          showInfo={showInfo}
          selected={isSelected(group.firstFrameId)}
          selectionActive={selectionActive}
          onActivate={onActivate}
          onSelect={onSelect}
          onDelete={(ids) => onDeleteGroup(ids)}
        />
      ))}
    </ImageGrid>
  )
}
