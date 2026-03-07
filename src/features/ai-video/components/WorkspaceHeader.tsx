import { Trash2 } from 'lucide-react'

interface WorkspaceHeaderProps {
  wsName: {
    name: string
    isEditing: boolean
    editValue: string
    setEditValue: (value: string) => void
    inputRef: React.RefObject<HTMLInputElement | null>
    startRename: () => void
    saveRename: () => void
    cancelRename: () => void
  }
  creditBalance: number | null
  onDelete: () => void
  variant?: 'full' | 'minimal'
}

export function WorkspaceHeader({
  wsName,
  creditBalance,
  onDelete,
  variant = 'full',
}: WorkspaceHeaderProps) {
  if (variant === 'minimal') {
    return (
      <div className="flex items-center gap-2 bg-primary-dark px-6 py-2 -mx-6 -mt-6">
        <span className="text-sm font-medium">AI Video</span>
        {creditBalance !== null && (
          <>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {creditBalance} credits
            </span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 bg-primary-dark px-6 py-2 -mx-6 -mt-6">
      {wsName.isEditing ? (
        <input
          ref={wsName.inputRef}
          value={wsName.editValue}
          onChange={(e) => wsName.setEditValue(e.target.value)}
          onBlur={wsName.saveRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') wsName.saveRename()
            if (e.key === 'Escape') wsName.cancelRename()
          }}
          className="text-sm font-medium bg-transparent border-b border-foreground/30 outline-none px-0 py-0 w-48"
        />
      ) : (
        <button
          onClick={wsName.startRename}
          className="text-sm font-medium hover:text-foreground/70 transition-colors cursor-text"
        >
          {wsName.name || 'Untitled'}
        </button>
      )}
      {creditBalance !== null && (
        <>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {creditBalance} credits
          </span>
        </>
      )}
      <button
        onClick={onDelete}
        className="ml-auto text-muted-foreground hover:text-destructive transition-colors p-1"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}
