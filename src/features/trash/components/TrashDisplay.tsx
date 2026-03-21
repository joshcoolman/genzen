import { useState } from 'react'
import { CheckCircle2, Circle, RotateCcw, Trash2, X } from 'lucide-react'
import { useTrash } from '../hooks/useTrash'
import { TrashDownloadButton } from './TrashDownloadButton'
import { useAuth } from '@/lib/auth'
import { useSelection } from '@/lib/use-selection'
import { ImageGrid } from '@/components/ImageGrid'
import { Thumbnail } from '@/components/Thumbnail'
import { SelectionDrawer } from '@/components/SelectionDrawer'
import { formatFileSize } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

function formatDeletedDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

export function TrashDisplay() {
  const { user } = useAuth()
  const {
    images,
    imageUrls,
    isLoading,
    restore,
    permanentDelete,
    permanentDeleteMany,
    restoreMany,
    emptyTrash,
    signFullResUrls,
  } = useTrash(user?.id)
  const [actionId, setActionId] = useState<string | null>(null)
  const [isEmptying, setIsEmptying] = useState(false)
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  const selection = useSelection({
    items: images.map((img) => img.id),
  })

  async function handleRestore(id: string) {
    setActionId(id)
    try {
      await restore(id)
    } finally {
      setActionId(null)
    }
  }

  async function handlePermanentDelete(id: string) {
    setActionId(id)
    try {
      await permanentDelete(id)
    } finally {
      setActionId(null)
    }
  }

  async function handleEmptyTrash() {
    setIsEmptying(true)
    try {
      await emptyTrash()
    } finally {
      setIsEmptying(false)
    }
  }

  async function handleBatchDelete() {
    const ids = Array.from(selection.selectedIds)
    setIsBatchDeleting(true)
    try {
      await permanentDeleteMany(ids)
      selection.clearSelection()
    } finally {
      setIsBatchDeleting(false)
    }
  }

  async function handleBatchRestore() {
    const ids = Array.from(selection.selectedIds)
    setIsBatchDeleting(true)
    try {
      await restoreMany(ids)
      selection.clearSelection()
    } finally {
      setIsBatchDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground">
        Loading...
      </div>
    )
  }

  const hasSelection = selection.count > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trash</h1>
          {images.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {images.length} {images.length === 1 ? 'item' : 'items'}
            </p>
          )}
        </div>
        {images.length > 0 && (
          <div className="flex gap-2">
            <TrashDownloadButton
              images={images}
              signFullResUrls={signFullResUrls}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isEmptying}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Empty Trash
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Empty Trash?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {images.length}{' '}
                    {images.length === 1 ? 'item' : 'items'} and their files.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleEmptyTrash}>
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {images.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
          <Trash2 className="h-8 w-8" />
          <p>Trash is empty</p>
        </div>
      ) : (
        <ImageGrid layout="list" size="md">
          {images.map((image) => {
            const selected = selection.isSelected(image.id)
            return (
              <div
                key={image.id}
                className={`flex cursor-pointer select-none items-center gap-3 rounded-lg transition-colors ${
                  selected ? 'bg-accent/50' : 'hover:bg-accent/20'
                }`}
                onClick={(e) => selection.toggle(image.id, e.shiftKey)}
              >
                <div className="shrink-0 pl-3">
                  {selected ? (
                    <CheckCircle2 className="h-5 w-5 text-accent-brand" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/50" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Thumbnail
                    url={imageUrls[image.id] ?? null}
                    alt={image.title}
                    layout="list"
                    listImageClassName="h-24 w-24"
                    selected={selected}
                    selectedClassName="border-accent-brand ring-1 ring-accent-brand"
                    footer={
                      <div className="flex min-w-0 flex-1 items-center justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {image.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {image.source === 'ai_generated' ? 'AI' : 'Upload'}
                            {' -- '}
                            {formatFileSize(image.file_size)}
                            {' -- '}
                            Deleted {formatDeletedDate(image.deleted_at)}
                          </p>
                        </div>
                        {!hasSelection && (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionId === image.id}
                              onClick={(e: React.MouseEvent) => {
                                e.stopPropagation()
                                handleRestore(image.id)
                              }}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Restore
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  disabled={actionId === image.id}
                                  onClick={(e: React.MouseEvent) =>
                                    e.stopPropagation()
                                  }
                                >
                                  <X className="mr-1 h-3 w-3" />
                                  Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete forever?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    &ldquo;{image.title}&rdquo; will be
                                    permanently deleted. This action cannot be
                                    undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() =>
                                      handlePermanentDelete(image.id)
                                    }
                                  >
                                    Delete Forever
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    }
                  />
                </div>
              </div>
            )
          })}
        </ImageGrid>
      )}

      <SelectionDrawer
        count={selection.count}
        onClear={selection.clearSelection}
      >
        <Button
          variant="ghost"
          size="sm"
          disabled={isBatchDeleting}
          onClick={handleBatchRestore}
        >
          <RotateCcw className="mr-1 h-3 w-3" />
          Restore ({selection.count})
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isBatchDeleting}>
              <Trash2 className="mr-1 h-3 w-3" />
              Delete ({selection.count})
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete {selection.count} items?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {selection.count}{' '}
                {selection.count === 1 ? 'item' : 'items'} and their files. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleBatchDelete}>
                Delete Forever
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SelectionDrawer>
    </div>
  )
}
