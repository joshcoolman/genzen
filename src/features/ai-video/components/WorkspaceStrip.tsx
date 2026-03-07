import { Plus } from 'lucide-react'
import type { Workspace } from '@/features/ai-video/hooks/use-workspaces'
import { cn } from '@/lib/utils'

interface WorkspaceStripProps {
  workspaces: Array<Workspace>
  activeWorkspaceId: string | null
  onSelect: (id: string) => void
  onCreateNew: () => void
}

export function WorkspaceStrip({
  workspaces,
  activeWorkspaceId,
  onSelect,
  onCreateNew,
}: WorkspaceStripProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Workspaces</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWorkspaceId
          return (
            <button
              key={ws.id}
              onClick={() => onSelect(ws.id)}
              className={cn(
                'shrink-0 w-[120px] rounded-md border overflow-hidden transition-colors text-left',
                isActive
                  ? 'border-foreground ring-1 ring-foreground'
                  : 'border-border hover:border-foreground/30',
              )}
            >
              {ws.preview.heroUrl ? (
                <div className="relative aspect-[3/2]">
                  <img
                    src={ws.preview.heroUrl}
                    alt={ws.name}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1">
                    <p className="text-[10px] font-medium text-white truncate">
                      {ws.name}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="aspect-[3/2] flex items-center justify-center bg-muted/30">
                  <p className="text-[10px] font-medium text-muted-foreground truncate px-2">
                    {ws.name}
                  </p>
                </div>
              )}
            </button>
          )
        })}

        <button
          onClick={onCreateNew}
          className="shrink-0 w-[120px] aspect-[3/2] rounded-md border border-dashed border-border hover:border-foreground/30 transition-colors flex items-center justify-center"
        >
          <Plus className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
