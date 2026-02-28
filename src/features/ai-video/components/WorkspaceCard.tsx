import type { Workspace } from '@/features/ai-video/hooks/use-workspaces'

interface WorkspaceCardProps {
  workspace: Workspace
  onClick: () => void
}

export function WorkspaceCard({ workspace, onClick }: WorkspaceCardProps) {
  const hasHero = !!workspace.preview.heroUrl
  const hasThumbnails =
    workspace.generationCount >= 4 &&
    (workspace.preview.thumbnailUrls.length > 0 ||
      workspace.preview.lastFrameUrl)

  const thumbs: Array<string> = []
  if (workspace.preview.lastFrameUrl) {
    thumbs.push(workspace.preview.lastFrameUrl)
  }
  for (const url of workspace.preview.thumbnailUrls) {
    if (thumbs.length >= 4) break
    thumbs.push(url)
  }

  if (!hasHero) {
    return (
      <button
        onClick={onClick}
        className="rounded-lg border border-dashed border-border p-8 text-center space-y-2 hover:border-foreground/30 transition-colors"
      >
        <p className="text-sm font-medium">{workspace.name}</p>
        <p className="text-xs text-muted-foreground">No generations yet</p>
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="group relative aspect-[3/2] rounded-lg border border-border overflow-hidden hover:border-foreground/30 transition-colors text-left"
    >
      <img
        src={workspace.preview.heroUrl!}
        alt={workspace.name}
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded z-10">
        {workspace.generationCount}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-black/75 px-3 py-2.5 z-10">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">
            {workspace.name}
          </p>
          {workspace.preview.prompt && (
            <p className="text-[11px] text-white/50 line-clamp-1 mt-0.5">
              {workspace.preview.prompt}
            </p>
          )}
        </div>
        {hasThumbnails && thumbs.length > 0 && (
          <div className="flex gap-1 shrink-0">
            {thumbs.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="w-7 h-7 rounded object-cover border border-white/10"
              />
            ))}
          </div>
        )}
      </div>
    </button>
  )
}
