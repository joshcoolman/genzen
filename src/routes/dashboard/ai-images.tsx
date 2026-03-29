import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
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
import type { SavedAiImage } from '@/features/ai-images/types'
import {
  GeneratorPanel,
  ImageGallery,
  ImageLightbox,
  useAiImagesPage,
} from '@/features/ai-images'
import { VariationPromptsDialog } from '@/features/ai-images/components/VariationPromptsDialog'
import { ParentPickerDialog } from '@/features/ai-images/components/ParentPickerDialog'
import { reparentImage } from '@/features/ai-images/server/reparent-image.server'
import { DescribeDialog } from '@/features/ai-images/components/DescribeDialog'
import { GroupPickerDialog } from '@/features/ai-images/components/GroupPickerDialog'
import { useAiImagesADContext } from '@/features/ai-images/hooks/useAiImagesADContext'
import { useImageUpload } from '@/features/user-images/hooks/useImageUpload'
import { supabase } from '@/lib/supabase'
import { createImageStorage } from '@/lib/image-storage'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSelection } from '@/lib/use-selection'
import { SelectionDrawer } from '@/components/SelectionDrawer'

export const Route = createFileRoute('/dashboard/ai-images')({
  beforeLoad: ({ context }) => {
    if ((context as { accountStatus: string }).accountStatus !== 'active') {
      throw redirect({ to: '/dashboard/pending' })
    }
  },
  component: AiImagesPage,
})

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

function getStoredPrefs(): AiImagesPrefs {
  if (typeof window === 'undefined')
    return { thumbSize: 'lg', sortAsc: false, showInfo: true }
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw)
      return {
        ...{ thumbSize: 'lg', sortAsc: false, showInfo: true },
        ...JSON.parse(raw),
      }
  } catch {
    // ignore
  }
  return { thumbSize: 'lg', sortAsc: false, showInfo: true }
}

function storePrefs(partial: Partial<AiImagesPrefs>) {
  try {
    const current = getStoredPrefs()
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...partial }))
  } catch {
    // ignore
  }
}

function AiImagesPage() {
  const page = useAiImagesPage()
  const navigate = useNavigate()
  useAiImagesADContext(page)
  const { upload } = useImageUpload(page.userId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // View prefs
  const [storedPrefs] = useState(getStoredPrefs)
  const [thumbSize, setThumbSize] = useState<'lg' | 'md' | 'sm'>(
    storedPrefs.thumbSize,
  )
  const [sortAsc, setSortAsc] = useState(storedPrefs.sortAsc)
  const [showInfo, setShowInfo] = useState(storedPrefs.showInfo)

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

  const handleUploadFiles = useCallback(
    (files: Array<File>) => {
      // Show skeleton placeholders immediately, upload in parallel.
      // No blob preview -- avoids jarring mismatch when realtime swaps the card.
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
            await upload({ file, title: file.name, description: null })
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
              await upload({ file, title: file.name, description: null })
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
      if (!page.accessToken) return
      const images = batchSelectedImages()
      setIsBatchMoving(true)
      try {
        for (const img of images) {
          await reparentImage({
            data: {
              accessToken: page.accessToken,
              imageId: img.id,
              action: 'adopt',
              newParentId,
            },
          })
        }
        selection.clearSelection()
        setBatchMoveOpen(false)
        await page.gallery.refresh()
      } catch (err) {
        console.error('Batch move failed:', err)
      } finally {
        setIsBatchMoving(false)
      }
    },
    [page.accessToken, batchSelectedImages, selection, page.gallery],
  )

  // Group
  const [groupOpen, setGroupOpen] = useState(false)
  const [isGrouping, setIsGrouping] = useState(false)

  const handleGroupConfirm = useCallback(
    async (primaryId: string) => {
      if (!page.accessToken) return
      const selected = batchSelectedImages()
      setIsGrouping(true)
      try {
        // Collect all image IDs involved: selected images + their children
        const allIds = new Set<string>()
        for (const img of selected) {
          allIds.add(img.id)
          const children = page.editChildrenMap[img.id] as
            | Array<unknown>
            | undefined
          if (children) {
            for (const child of children as Array<{ id: string }>) {
              allIds.add(child.id)
            }
          }
        }
        // Remove the primary — it stays as root
        allIds.delete(primaryId)

        // Adopt all others under primaryId
        for (const id of allIds) {
          await reparentImage({
            data: {
              accessToken: page.accessToken,
              imageId: id,
              action: 'adopt',
              newParentId: primaryId,
            },
          })
        }
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
      page.accessToken,
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
      for (const img of selected) {
        const children = page.editChildrenMap[img.id] as
          | Array<unknown>
          | undefined
        if (children && children.length > 0) {
          await page.gallery.ungroupChildren(img)
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
        // Fetch ALL descendants via BFS
        const { data: allRows } = await supabase
          .from('user_images')
          .select('id, storage_path, generation_metadata')
          .eq('user_id', page.userId!)
          .is('deleted_at', null)

        const childrenOf = new Map<
          string,
          Array<{ id: string; storage_path: string | null }>
        >()
        for (const row of allRows ?? []) {
          const meta = row.generation_metadata as Record<string, unknown> | null
          const srcId = meta?.source_image_id as string | undefined
          if (srcId) {
            const siblings = childrenOf.get(srcId) ?? []
            siblings.push(row)
            childrenOf.set(srcId, siblings)
          }
        }
        const descendants: Array<{ path: string }> = []
        const queue = [img.id]
        const visited = new Set<string>()
        while (queue.length > 0) {
          const current = queue.shift()!
          for (const row of childrenOf.get(current) ?? []) {
            if (visited.has(row.id)) continue
            visited.add(row.id)
            if (row.storage_path) {
              descendants.push({ path: row.storage_path })
            }
            queue.push(row.id)
          }
        }

        const items: Array<{ path: string; name: string }> = [
          { path: storagePath, name: `${baseName}-1${extOf(storagePath)}` },
        ]
        descendants.forEach((d, i) => {
          items.push({
            path: d.path,
            name: `${baseName}-${i + 2}${extOf(d.path)}`,
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

  // Describe dialog state
  const [describeTarget, setDescribeTarget] = useState<SavedAiImage | null>(
    null,
  )

  const handleDescribe = useCallback((img: SavedAiImage) => {
    setDescribeTarget(img)
  }, [])

  const [generatorOpen, setGeneratorOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('genzen:generator-panel-open') !== 'false'
  })

  const [panelPinned, setPanelPinned] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('genzen:generator-panel-pinned') !== 'false'
  })

  useEffect(() => {
    localStorage.setItem('genzen:generator-panel-open', String(generatorOpen))
  }, [generatorOpen])

  useEffect(() => {
    localStorage.setItem('genzen:generator-panel-pinned', String(panelPinned))
  }, [panelPinned])

  return (
    <div className={generatorOpen && panelPinned ? 'mr-80' : ''}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground tabular-nums">
            AI Images
            {page.credits.balance !== null && (
              <>
                <span className="mx-2 opacity-40">|</span>
                {page.credits.balance} credits
              </>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            {/* Thumb size toggle */}
            <button
              onClick={handleToggleThumbSize}
              className="flex w-14 items-center justify-center gap-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
              className={`rounded-md p-1.5 transition-colors ${
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
          thumbSize={thumbSize}
          showInfo={showInfo}
          onLoadPrompt={page.handleLoadPrompt}
          onLoadPromptAndModel={page.handleLoadPromptAndModel}
          onDelete={handleDelete}
          onRestoreRoot={page.gallery.restoreRootImage}
          onRetry={page.gallery.retryImage}
          onStartAdopt={page.reparent.startAdopt}
          onDownload={handleDownload}
          onUngroup={handleUngroup}
          onDescribe={handleDescribe}
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
          className={
            panelPinned
              ? 'fixed top-0 right-0 h-screen w-80 border-l border-border bg-black/90 backdrop-blur-2xl overflow-y-auto z-30'
              : 'fixed top-0 right-0 h-screen w-80 border-l border-border bg-black/90 backdrop-blur-2xl overflow-y-auto z-30 shadow-xl'
          }
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
              credits={page.credits}
              userImages={page.userImages}
              error={page.error}
              describe={page.describe}
              providerOverride={page.providerOverride}
              onProviderOverrideChange={page.setProviderOverride}
            />
          </div>
        </div>
      )}

      <VariationPromptsDialog
        open={!!page.variations.pendingVariation}
        onOpenChange={(open) => {
          if (!open) page.variations.cancelVariationPreview()
        }}
        prompts={page.variations.pendingVariation?.prompts ?? []}
        loading={page.variations.generatingPrompts}
        submitting={page.variations.submittingVariations}
        onRun={page.variations.handleRunVariations}
        sourceImageUrl={
          page.variations.pendingVariation
            ? page.gallery.imageUrls[
                page.variations.pendingVariation.sourceImageId
              ]
            : undefined
        }
        referenceImages={[]}
        onAddReference={() => {}}
        onRemoveReference={() => {}}
        onGenerateMore={() => {}}
        generatingMore={false}
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
          imageUrls={page.lightbox.mergedUrls}
          fullResUrls={page.lightbox.fullResUrls}
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
            navigate({
              to: '/dashboard/edit/$imageId',
              params: { imageId },
              search: { sourceId },
            })
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
          accessToken={page.accessToken}
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
