'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  FolderInput,
  Group,
  Info,
  LayoutGrid,
  Pin,
  PinOff,
  Plus,
  Trash2,
  Ungroup,
  Upload,
  X,
} from 'lucide-react'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { GeneratorPanel } from '../../_components/generator-panel/generator-panel'
import { ImageGallery } from '../../_components/image-gallery/image-gallery'
import { VariationPromptsDialog } from '../../_components/variation-prompts-dialog/variation-prompts-dialog'
import { DescribeDialog } from '../../_components/describe-dialog/describe-dialog'
import { ImageLightbox } from './image-lightbox/image-lightbox'
import { ParentPickerDialog } from './parent-picker-dialog/parent-picker-dialog'
import { GroupPickerDialog } from './group-picker-dialog/group-picker-dialog'
import type { SavedAiImage } from '#/features/ai-images/types'
import { usePersistedState } from '#/lib/use-persisted-state'
import { useIsMobile } from '#/lib/hooks/use-is-mobile'
import { MobileDialogHeader } from '#/components/MobileDialogHeader'
import { useAiImagesPage } from '#/features/ai-images'
import { groupImages } from '#/features/ai-images/server/group-images.server'
import { ungroupImages } from '#/features/ai-images/server/ungroup-images.server'
import { useAiImagesADContext } from '#/features/ai-images/hooks/useAiImagesADContext'
import { useImageUpload } from '#/features/user-images/hooks/useImageUpload'
import { listSubtreeStoragePaths } from '#/features/ai-images/server/gallery.actions'
import { createImageStorage } from '#/lib/image-storage'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { useSelection } from '#/lib/use-selection'
import { SelectionDrawer } from '#/components/SelectionDrawer'
import { useADOpen } from '#/lib/use-ad-open'
import { cn } from '#/lib/utils'

const THUMB_SIZES = ['lg', 'md', 'sm'] as const
const THUMB_LABELS: Record<(typeof THUMB_SIZES)[number], string> = {
  lg: 'LG',
  md: 'MD',
  sm: 'SM',
}

interface AiImagesPrefs {
  thumbSize: 'lg' | 'md' | 'sm'
  sortAsc: boolean
  showInfo: boolean
}

const PREFS_KEY = 'genzen:ai-images-prefs'

const DEFAULT_PREFS: AiImagesPrefs = {
  thumbSize: 'lg',
  sortAsc: false,
  showInfo: true,
}

// Only ever called from an effect, never during render -- see usePersistedState.
function getStoredPrefs(): AiImagesPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return DEFAULT_PREFS
}

function storePrefs(partial: Partial<AiImagesPrefs>) {
  try {
    const current = getStoredPrefs()
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...partial }))
  } catch {
    // ignore
  }
}

export function AiImagesPage() {
  const page = useAiImagesPage()
  const router = useRouter()
  useAiImagesADContext(page)
  const { upload } = useImageUpload(page.userId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // View prefs
  const [thumbSize, setThumbSize] = usePersistedState<'lg' | 'md' | 'sm'>(
    () => getStoredPrefs().thumbSize,
    DEFAULT_PREFS.thumbSize,
  )
  const [sortAsc, setSortAsc] = usePersistedState(
    () => getStoredPrefs().sortAsc,
    DEFAULT_PREFS.sortAsc,
  )
  const [showInfo, setShowInfo] = usePersistedState(
    () => getStoredPrefs().showInfo,
    DEFAULT_PREFS.showInfo,
  )

  // Force lg thumb size on mobile (<400px)
  const isMobile = useIsMobile()
  const { isOpen: isADOpen } = useADOpen()
  const effectiveThumbSize = isMobile ? 'lg' : thumbSize

  const handleToggleThumbSize = () => {
    setThumbSize((v) => {
      const idx = THUMB_SIZES.indexOf(v)
      const next = THUMB_SIZES[(idx + 1) % THUMB_SIZES.length]
      storePrefs({ thumbSize: next })
      return next
    })
  }

  const handleToggleSort = () => {
    setSortAsc((v) => {
      storePrefs({ sortAsc: !v })
      return !v
    })
  }

  const handleToggleInfo = () => {
    setShowInfo((v) => {
      storePrefs({ showInfo: !v })
      return !v
    })
  }

  // Sort images based on sortAsc preference
  const sortedImages = sortAsc
    ? [...page.gallery.images].reverse()
    : page.gallery.images

  const selection = useSelection({
    items: sortedImages.map((img) => img.id),
  })

  useEffect(() => {
    const completedSelectedIds = Array.from(selection.selectedIds).filter(
      (id) =>
        page.gallery.images.find((i) => i.id === id)?.status === 'completed',
    )
    page.generator.setAutoRefImageIds(completedSelectedIds)
  }, [selection.selectedIds, page.gallery.images])

  const handleUploadFiles = useCallback(
    (files: Array<File>) => {
      // Show skeleton placeholders immediately, upload in parallel.
      // No blob preview -- avoids a jarring mismatch when the real card lands.
      // On failure: remove the card.
      for (const file of files) {
        const tempId = `upload-${Date.now()}-${crypto.randomUUID()}`
        page.gallery.addOptimisticCard({
          id: tempId,
          title: file.name,
          storage_path: null,
          created_at: new Date().toISOString(),
          status: 'completed',
          generation_error: null,
          generation_metadata: null,
        })

        void (async () => {
          try {
            const created = await upload({
              file,
              title: file.name,
              description: null,
            })
            // The realtime INSERT used to swap this card by matching on title
            // (#174). The upload's own return value identifies it exactly.
            page.gallery.replaceOptimisticCard(tempId, {
              id: created.id,
              title: created.title,
              storage_path: null,
              created_at: new Date().toISOString(),
              status: 'completed',
              generation_error: null,
              generation_metadata: null,
            })
            if (created.url) page.gallery.setImageUrl(created.id, created.url)
            void page.gallery.refresh({ silent: true })
          } catch {
            page.gallery.removeOptimisticCard(tempId)
          }
        })()
      }
    },
    [upload, page.gallery],
  )

  // Paste handler — shows blob preview (single image, no ordering confusion)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          e.preventDefault()

          const tempId = `paste-${Date.now()}-${crypto.randomUUID()}`
          const previewUrl = URL.createObjectURL(file)
          page.gallery.addOptimisticCard({
            id: tempId,
            title: file.name,
            storage_path: null,
            created_at: new Date().toISOString(),
            status: 'completed',
            generation_error: null,
            generation_metadata: null,
          })
          page.gallery.setImageUrl(tempId, previewUrl)

          void (async () => {
            try {
              const created = await upload({
                file,
                title: file.name,
                description: null,
              })
              page.gallery.replaceOptimisticCard(tempId, {
                id: created.id,
                title: created.title,
                storage_path: null,
                created_at: new Date().toISOString(),
                status: 'completed',
                generation_error: null,
                generation_metadata: null,
              })
              // Keep the blob preview until the refresh brings a real URL --
              // swapping to nothing would blink the card empty.
              page.gallery.setImageUrl(created.id, created.url || previewUrl)
              void page.gallery.refresh({ silent: true })
            } catch {
              page.gallery.removeOptimisticCard(tempId)
            }
          })()
          return
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [upload, page.gallery])

  // Delete confirmation for images with children
  const [deleteTarget, setDeleteTarget] = useState<SavedAiImage | null>(null)

  const deleteTargetChildren = deleteTarget
    ? (page.editChildrenMap[deleteTarget.id] as Array<unknown> | undefined)
    : undefined
  const childCount = deleteTargetChildren?.length ?? 0

  const handleDelete = useCallback(
    (img: SavedAiImage) => {
      const children = page.editChildrenMap[img.id] as
        | Array<unknown>
        | undefined
      const hasChildren = (children?.length ?? 0) > 0
      if (hasChildren) {
        setDeleteTarget(img)
      } else {
        void page.gallery.deleteImage(img)
      }
    },
    [page.editChildrenMap, page.gallery],
  )

  // Batch delete
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)

  const batchSelectedImages = useCallback(() => {
    return sortedImages.filter((img) => selection.selectedIds.has(img.id))
  }, [sortedImages, selection.selectedIds])

  const batchChildCount = useCallback(() => {
    let count = 0
    for (const id of selection.selectedIds) {
      const children = page.editChildrenMap[id] as Array<unknown> | undefined
      if (children?.length) count += children.length
    }
    return count
  }, [selection.selectedIds, page.editChildrenMap])

  const batchHasChildren = useCallback(() => {
    for (const id of selection.selectedIds) {
      const children = page.editChildrenMap[id] as Array<unknown> | undefined
      if (children?.length) return true
    }
    return false
  }, [selection.selectedIds, page.editChildrenMap])

  const executeBatchDelete = useCallback(
    async (strategy: 'smart' | 'cascade' | 'detach') => {
      const images = batchSelectedImages()
      setIsBatchDeleting(true)
      try {
        for (const img of images) {
          switch (strategy) {
            case 'smart':
              await page.gallery.deleteImage(img)
              break
            case 'cascade':
              await page.gallery.deleteImageWithDescendants(img)
              break
            case 'detach':
              await page.gallery.deleteAndDetachChildren(img)
              break
          }
        }
        selection.clearSelection()
      } finally {
        setIsBatchDeleting(false)
        setBatchDeleteOpen(false)
      }
    },
    [batchSelectedImages, page.gallery, selection],
  )

  const handleBatchDelete = useCallback(() => {
    if (batchHasChildren()) {
      setBatchDeleteOpen(true)
    } else {
      void executeBatchDelete('smart')
    }
  }, [batchHasChildren, executeBatchDelete])

  // Batch move
  const [batchMoveOpen, setBatchMoveOpen] = useState(false)
  const [isBatchMoving, setIsBatchMoving] = useState(false)

  const handleBatchMoveConfirm = useCallback(
    async (newParentId: string) => {
      const images = batchSelectedImages()
      setIsBatchMoving(true)
      try {
        await groupImages({
          primaryId: newParentId,
          childIds: images.map((img) => img.id),
        })
        selection.clearSelection()
        setBatchMoveOpen(false)
        await page.gallery.refresh()
        page.refreshEditChildren()
      } catch (err) {
        console.error('Batch move failed:', err)
      } finally {
        setIsBatchMoving(false)
      }
    },
    [batchSelectedImages, selection, page.gallery, page.refreshEditChildren],
  )

  // Group
  const [groupOpen, setGroupOpen] = useState(false)
  const [isGrouping, setIsGrouping] = useState(false)

  const handleGroupConfirm = useCallback(
    async (primaryId: string) => {
      const selected = batchSelectedImages()
      setIsGrouping(true)
      try {
        // Collect all image IDs: selected images + their existing children
        const allIds = new Set<string>()
        for (const img of selected) {
          allIds.add(img.id)
          for (const child of page.editChildrenMap[img.id] ?? []) {
            allIds.add(child.id)
          }
        }
        // Remove the primary — it stays as the group parent
        allIds.delete(primaryId)

        // Single batch call
        await groupImages({
          primaryId,
          childIds: Array.from(allIds),
        })
        selection.clearSelection()
        setGroupOpen(false)
        await page.gallery.refresh()
        page.refreshEditChildren()
      } catch (err) {
        console.error('Group failed:', err)
      } finally {
        setIsGrouping(false)
      }
    },
    [
      batchSelectedImages,
      page.editChildrenMap,
      selection,
      page.gallery,
      page.refreshEditChildren,
    ],
  )

  // Batch ungroup
  const [isBatchUngrouping, setIsBatchUngrouping] = useState(false)

  const handleBatchUngroup = useCallback(async () => {
    const selected = batchSelectedImages()
    setIsBatchUngrouping(true)
    try {
      // Ungroup each selected parent that has children
      for (const img of selected) {
        if ((page.editChildrenMap[img.id] ?? []).length > 0) {
          await ungroupImages({ parentId: img.id })
        }
      }
      selection.clearSelection()
      await page.gallery.refresh()
      page.refreshEditChildren()
    } catch (err) {
      console.error('Batch ungroup failed:', err)
    } finally {
      setIsBatchUngrouping(false)
    }
  }, [
    batchSelectedImages,
    page.editChildrenMap,
    page.gallery,
    page.refreshEditChildren,
    selection,
  ])

  // Download: two-step flow — dialog for name, then build + save
  const [downloadTarget, setDownloadTarget] = useState<SavedAiImage | null>(
    null,
  )
  const [downloadName, setDownloadName] = useState('')
  const [downloading, setDownloading] = useState(false)

  const handleDownload = useCallback((img: SavedAiImage) => {
    setDownloadTarget(img)
    setDownloadName(img.title || '')
  }, [])

  const extOf = (path: string) => {
    const base = path.split('/').pop() ?? path
    const dot = base.lastIndexOf('.')
    return dot > 0 ? base.slice(dot) : '.png'
  }

  const executeDownload = useCallback(async () => {
    if (!downloadTarget?.storage_path) return
    const img = downloadTarget
    const storagePath = img.storage_path!
    const baseName = (downloadName || img.id).replace(/[/\\:*?"<>|]/g, '-')

    setDownloading(true)
    try {
      const children = page.editChildrenMap[img.id] as
        | Array<{ id: string; url: string }>
        | undefined
      const hasChildren = (children?.length ?? 0) > 0

      if (!hasChildren) {
        const url = await createImageStorage().getUrl(storagePath)
        if (!url) return
        const response = await fetch(url)
        const blob = await response.blob()
        saveAs(blob, `${baseName}${extOf(storagePath)}`)
      } else {
        // The subtree walk (by parent_id, the mutable grouping parent) runs
        // server-side -- see listSubtreeStoragePaths.
        const descendantPaths = await listSubtreeStoragePaths(img.id)

        const items: Array<{ path: string; name: string }> = [
          { path: storagePath, name: `${baseName}-1${extOf(storagePath)}` },
        ]
        descendantPaths.forEach((path, i) => {
          items.push({
            path,
            name: `${baseName}-${i + 2}${extOf(path)}`,
          })
        })

        const zip = new JSZip()
        for (const item of items) {
          const url = await createImageStorage().getUrl(item.path)
          if (!url) continue
          const response = await fetch(url)
          const blob = await response.blob()
          zip.file(item.name, blob)
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' })
        saveAs(zipBlob, `${baseName}.zip`)
      }
    } finally {
      setDownloading(false)
      setDownloadTarget(null)
    }
  }, [downloadTarget, downloadName, page.editChildrenMap, page.userId])

  // Ungroup handler
  const handleUngroup = useCallback(
    async (img: SavedAiImage) => {
      await page.gallery.ungroupChildren(img)
      await page.gallery.refresh()
      page.refreshEditChildren()
    },
    [page.gallery, page.refreshEditChildren],
  )

  // Unlink handler — detach a single image from its group parent
  const handleUnlink = useCallback(
    async (img: SavedAiImage) => {
      await ungroupImages({ imageIds: [img.id] })
      await page.gallery.refresh()
      page.refreshEditChildren()
    },
    [page.gallery, page.refreshEditChildren],
  )

  // Describe dialog state
  const [describeTarget, setDescribeTarget] = useState<SavedAiImage | null>(
    null,
  )

  const handleDescribe = useCallback((img: SavedAiImage) => {
    setDescribeTarget(img)
  }, [])

  const [generatorOpen, setGeneratorOpen, generatorOpenHydrated] =
    usePersistedState(
      () => localStorage.getItem('genzen:generator-panel-open') !== 'false',
      true,
    )

  const [panelPinned, setPanelPinned, panelPinnedHydrated] = usePersistedState(
    () => localStorage.getItem('genzen:generator-panel-pinned') !== 'false',
    true,
  )

  useEffect(() => {
    if (!generatorOpenHydrated) return
    localStorage.setItem('genzen:generator-panel-open', String(generatorOpen))
  }, [generatorOpen, generatorOpenHydrated])

  useEffect(() => {
    if (!panelPinnedHydrated) return
    localStorage.setItem('genzen:generator-panel-pinned', String(panelPinned))
  }, [panelPinned, panelPinnedHydrated])

  return (
    <div
      className={cn(
        'transition-all duration-300',
        generatorOpen && panelPinned && !isADOpen && 'mr-80',
        generatorOpen && panelPinned && isADOpen && !isMobile && 'mr-[640px]',
        !panelPinned && isADOpen && !isMobile && 'mr-80',
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-end xs:justify-between">
          <span className="hidden text-sm text-muted-foreground tabular-nums xs:inline">
            AI Images
          </span>
          <div className="flex items-center gap-1.5">
            {/* Thumb size toggle */}
            <button
              onClick={handleToggleThumbSize}
              className="hidden w-14 items-center justify-center gap-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors xs:flex"
              aria-label={`Thumbnail size: ${THUMB_LABELS[thumbSize]}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">
                {THUMB_LABELS[thumbSize]}
              </span>
            </button>

            {/* Sort toggle */}
            <button
              onClick={handleToggleSort}
              className="hidden rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors xs:block"
              aria-label={sortAsc ? 'Sort oldest first' : 'Sort newest first'}
            >
              {sortAsc ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </button>

            {/* Info toggle */}
            <button
              onClick={handleToggleInfo}
              className={`hidden rounded-md p-1.5 transition-colors xs:block ${
                showInfo
                  ? 'text-foreground bg-muted'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              aria-label={showInfo ? 'Hide info' : 'Show info'}
            >
              <Info className="h-4 w-4" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                if (files.length > 0) void handleUploadFiles(files)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Upload image"
            >
              <Upload className="h-4 w-4" />
            </button>
            {!generatorOpen && (
              <button
                onClick={() => setGeneratorOpen(true)}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-accent-brand text-white hover:bg-accent-brand/90 transition-colors"
                title="New generation"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <ImageGallery
          images={sortedImages}
          imageUrls={page.gallery.imageUrls}
          rootImageMeta={page.gallery.rootImageMeta}
          editChildrenMap={page.editChildrenMap}
          loadingGallery={page.gallery.loadingGallery}
          thumbSize={effectiveThumbSize}
          showInfo={showInfo}
          onLoadPrompt={page.handleLoadPrompt}
          onLoadPromptAndModel={page.handleLoadPromptAndModel}
          onDelete={handleDelete}
          onRestoreRoot={page.gallery.restoreRootImage}
          onRetry={page.gallery.retryImage}
          onStartAdopt={page.reparent.startAdopt}
          onDownload={handleDownload}
          onUngroup={handleUngroup}
          onUnlink={handleUnlink}
          onDescribe={handleDescribe}
          onGenerateVariations={page.variations.openVariationDialog}
          onGallery={page.lightbox.open}
          selectionActive={selection.count > 0}
          isSelected={selection.isSelected}
          onSelect={selection.toggle}
        />

        <SelectionDrawer
          count={selection.count}
          onClear={selection.clearSelection}
        >
          {selection.count >= 2 && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isGrouping}
              onClick={() => setGroupOpen(true)}
            >
              <Group className="mr-1 h-3 w-3" />
              {isGrouping ? 'Grouping...' : 'Group'}
            </Button>
          )}
          {batchHasChildren() && (
            <Button
              variant="ghost"
              size="sm"
              disabled={isBatchUngrouping}
              onClick={() => void handleBatchUngroup()}
            >
              <Ungroup className="mr-1 h-3 w-3" />
              {isBatchUngrouping ? 'Ungrouping...' : 'Ungroup'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={isBatchMoving}
            onClick={() => setBatchMoveOpen(true)}
          >
            <FolderInput className="mr-1 h-3 w-3" />
            {isBatchMoving ? 'Moving...' : `Move (${selection.count})`}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={isBatchDeleting}
            onClick={handleBatchDelete}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            {isBatchDeleting ? 'Deleting...' : `Delete (${selection.count})`}
          </Button>
        </SelectionDrawer>
      </div>

      {/* Generator panel — full-screen dialog on mobile, right sidebar on desktop */}
      {isMobile ? (
        <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
          <DialogContent className="sm:max-w-full h-screen max-h-screen p-0 m-0 rounded-none border-0 flex flex-col">
            <MobileDialogHeader
              title="Generate"
              onClose={() => setGeneratorOpen(false)}
            />
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <GeneratorPanel
                generator={page.generator}
                modelSelector={page.modelSelector}
                userImages={page.userImages}
                describe={page.describe}
                modelDisplay="dropdown"
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <>
          {/* Dismiss overlay when unpinned */}
          {generatorOpen && !panelPinned && (
            <div
              className="fixed inset-0 z-20"
              onClick={() => setGeneratorOpen(false)}
            />
          )}

          {/* Right sidebar generator panel */}
          {generatorOpen && (
            <div
              className={cn(
                'fixed top-0 h-screen w-80 border-l border-border bg-black/90 backdrop-blur-2xl overflow-y-auto z-30 transition-all duration-300',
                isADOpen ? 'right-80' : 'right-0',
                !panelPinned && 'shadow-xl',
              )}
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <span className="text-xs text-muted-foreground">Generate</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPanelPinned((p) => !p)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    title={panelPinned ? 'Unpin (overlay)' : 'Pin (inline)'}
                  >
                    {panelPinned ? (
                      <Pin className="h-3.5 w-3.5" />
                    ) : (
                      <PinOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <button
                    onClick={() => setGeneratorOpen(false)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="px-4 pb-4">
                <GeneratorPanel
                  generator={page.generator}
                  modelSelector={page.modelSelector}
                  userImages={page.userImages}
                  describe={page.describe}
                />
              </div>
            </div>
          )}
        </>
      )}

      <VariationPromptsDialog
        open={page.variations.variationDialogOpen}
        onOpenChange={(open) => {
          if (!open) page.variations.cancelVariationPreview()
        }}
        prompts={page.variations.variationPrompts}
        loading={page.variations.generatingPrompts}
        onGenerate={(guidance, count) =>
          void page.variations.handlePreviewVariations(guidance, count)
        }
        onApply={(prompts) => {
          const sourceUrl = page.variations.pendingSourceImage
            ? page.gallery.imageUrls[page.variations.pendingSourceImage.id]
            : undefined
          page.variations.handleApplyVariations(
            prompts,
            page.generator.pastePrompts,
            sourceUrl,
            page.generator.setSourceFromUrl,
          )
        }}
        sourceImageUrl={
          page.variations.pendingSourceImage
            ? page.gallery.imageUrls[page.variations.pendingSourceImage.id]
            : undefined
        }
        referenceImages={[]}
        onAddReference={() => {}}
        onRemoveReference={() => {}}
      />

      {page.reparent.adoptTarget && (
        <ParentPickerDialog
          open={!!page.reparent.adoptTarget}
          onOpenChange={(open) => {
            if (!open) page.reparent.cancelAdopt()
          }}
          movingImage={page.reparent.adoptTarget}
          movingImageUrl={page.gallery.imageUrls[page.reparent.adoptTarget.id]}
          images={page.gallery.images}
          imageUrls={page.gallery.imageUrls}
          editChildrenMap={page.editChildrenMap}
          loading={page.reparent.isReparenting}
          onConfirm={(newParentId) =>
            void page.reparent.confirmAdopt(newParentId)
          }
        />
      )}

      {groupOpen && batchSelectedImages().length >= 2 && (
        <GroupPickerDialog
          open={groupOpen}
          onOpenChange={(open) => {
            if (!open) setGroupOpen(false)
          }}
          selectedImages={batchSelectedImages()}
          imageUrls={page.gallery.imageUrls}
          editChildrenMap={page.editChildrenMap}
          loading={isGrouping}
          onConfirm={(primaryId) => void handleGroupConfirm(primaryId)}
        />
      )}

      {batchMoveOpen && batchSelectedImages().length > 0 && (
        <ParentPickerDialog
          open={batchMoveOpen}
          onOpenChange={(open) => {
            if (!open) setBatchMoveOpen(false)
          }}
          movingImage={batchSelectedImages()[0]}
          movingImageUrl={undefined}
          movingImages={batchSelectedImages()}
          images={page.gallery.images}
          imageUrls={page.gallery.imageUrls}
          editChildrenMap={page.editChildrenMap}
          loading={isBatchMoving}
          onConfirm={(newParentId) => void handleBatchMoveConfirm(newParentId)}
        />
      )}

      {page.lightbox.isOpen && (
        <ImageLightbox
          items={page.lightbox.items}
          imageUrls={page.lightbox.imageUrls}
          currentIndex={page.lightbox.index!}
          onClose={page.lightbox.close}
          onNext={page.lightbox.next}
          onPrev={page.lightbox.prev}
          onDelete={page.lightbox.deleteAndAdvance}
          onEdit={() => {
            const item = page.lightbox.items[page.lightbox.index!]
            const imageId = item.parentId ?? item.id
            const sourceId = item.isChild ? item.id : undefined
            page.lightbox.close()
            router.push(
              sourceId
                ? `/dashboard/edit/${imageId}?sourceId=${sourceId}`
                : `/dashboard/edit/${imageId}`,
            )
          }}
        />
      )}

      {/* Download name dialog */}
      <Dialog
        open={!!downloadTarget}
        onOpenChange={(open) => {
          if (!open) setDownloadTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Download</DialogTitle>
          </DialogHeader>
          <Input
            value={downloadName}
            onChange={(e) => setDownloadName(e.target.value)}
            placeholder="Name..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && downloadName.trim()) {
                void executeDownload()
              }
            }}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDownloadTarget(null)}
              disabled={downloading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void executeDownload()}
              disabled={!downloadName.trim() || downloading}
            >
              {downloading ? 'Downloading...' : 'Download'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Describe dialog */}
      {describeTarget && (
        <DescribeDialog
          open={!!describeTarget}
          onOpenChange={(open) => {
            if (!open) setDescribeTarget(null)
          }}
          imageUrl={page.gallery.imageUrls[describeTarget.id]}
          imageId={describeTarget.id}
          currentDescription={describeTarget.description}
          onSave={() => void page.gallery.refresh()}
        />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              This image has {childCount}{' '}
              {childCount === 1 ? 'child' : 'children'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Delete just this image, or delete it along with all related
              images?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  void page.gallery.deleteAndDetachChildren(deleteTarget)
                  setDeleteTarget(null)
                }
              }}
            >
              Keep all
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  void page.gallery.deleteImage(deleteTarget)
                  setDeleteTarget(null)
                }
              }}
            >
              Keep children
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) {
                  void page.gallery.deleteImageWithDescendants(deleteTarget)
                  setDeleteTarget(null)
                }
              }}
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch delete confirmation for images with children */}
      <AlertDialog
        open={batchDeleteOpen}
        onOpenChange={(open) => {
          if (!open) setBatchDeleteOpen(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selection.count} images? ({batchChildCount()} children
              affected)
            </AlertDialogTitle>
            <AlertDialogDescription>
              Some selected images have children. Choose how to handle them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBatchDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isBatchDeleting}
              onClick={() => void executeBatchDelete('detach')}
            >
              Keep all
            </AlertDialogAction>
            <AlertDialogAction
              disabled={isBatchDeleting}
              onClick={() => void executeBatchDelete('smart')}
            >
              Keep children
            </AlertDialogAction>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isBatchDeleting}
              onClick={() => void executeBatchDelete('cascade')}
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
