import { useState } from 'react'
import { Check, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import type { UsePromptStudioReturn } from '../hooks/usePromptStudio'
import { ActionButton } from '@/components/ActionButton'
import { cn } from '@/lib/utils'

interface PromptSetsSidebarProps {
  studio: UsePromptStudioReturn
}

export function PromptSetsSidebar({ studio }: PromptSetsSidebarProps) {
  const [newName, setNewName] = useState('')
  const [showNameInput, setShowNameInput] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const handleSaveNew = () => {
    const name = newName.trim()
    if (!name) return
    studio.saveAsNew(name)
    setNewName('')
    setShowNameInput(false)
  }

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id)
    setEditName(currentName)
  }

  const handleFinishRename = (id: string) => {
    const name = editName.trim()
    if (name) studio.promptSets.renameSet(id, name)
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    studio.promptSets.deleteSet(id)
    setConfirmDeleteId(null)
  }

  return (
    <div className="w-[280px] shrink-0 border-l border-border bg-card">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Prompt Sets</h3>
          <button
            onClick={() => studio.setSidebarOpen(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Save actions */}
        {studio.activeSetId && studio.isDirty && (
          <div className="flex gap-2">
            <ActionButton
              onClick={studio.updateCurrentSet}
              icon={<Save className="size-3.5" />}
              className="flex-1 text-xs"
            >
              Update
            </ActionButton>
            <button
              onClick={() => setShowNameInput(true)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="size-3.5" />
              Save New
            </button>
          </div>
        )}

        {!studio.activeSetId && (
          <button
            onClick={() => setShowNameInput(true)}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="size-3.5" />
            Save Current
          </button>
        )}

        {showNameInput && (
          <div className="flex gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveNew()
                if (e.key === 'Escape') setShowNameInput(false)
              }}
              placeholder="Set name..."
              className="flex-1 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              onClick={handleSaveNew}
              disabled={!newName.trim()}
              className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <Check className="size-3.5" />
            </button>
          </div>
        )}

        {/* Set list */}
        <div className="space-y-1">
          {studio.promptSets.sets.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No saved prompt sets
            </p>
          )}

          {studio.promptSets.sets.map((set) => (
            <div
              key={set.id}
              className={cn(
                'group rounded-md px-3 py-2 text-sm cursor-pointer transition-colors',
                studio.activeSetId === set.id
                  ? 'bg-accent-brand/10 border border-accent-brand/30'
                  : 'hover:bg-muted',
              )}
              onClick={() => {
                if (editingId !== set.id && confirmDeleteId !== set.id) {
                  studio.loadSet(set.id)
                }
              }}
            >
              {editingId === set.id ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishRename(set.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onBlur={() => handleFinishRename(set.id)}
                    className="flex-1 rounded border border-input bg-transparent px-1.5 py-0.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{set.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(set.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartRename(set.id, set.name)
                      }}
                      className="p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-3" />
                    </button>
                    {confirmDeleteId === set.id ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(set.id)
                        }}
                        className="p-0.5 text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setConfirmDeleteId(set.id)
                          setTimeout(() => setConfirmDeleteId(null), 3000)
                        }}
                        className="p-0.5 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
