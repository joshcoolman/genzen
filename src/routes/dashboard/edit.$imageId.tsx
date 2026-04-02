import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  EyeOff,
  Info,
  LayoutGrid,
  Pin,
  PinOff,
  RotateCcw,
  Trash2,
  Unlink,
} from 'lucide-react'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import type { SavedAiImage } from '@/features/ai-images/types'
import { ImageGallery } from '@/features/ai-images/components/ImageGallery'
import { GeneratorPanel } from '@/features/ai-images/components/GeneratorPanel'
import { DescribeDialog } from '@/features/ai-images/components/DescribeDialog'
import { VariationPromptsDialog } from '@/features/ai-images/components/VariationPromptsDialog'
import { ExistingImagePicker } from '@/features/user-images/components/ExistingImagePicker'
import { ActionButton } from '@/components/ActionButton'
import { SelectionDrawer } from '@/components/SelectionDrawer'
import { Lightbox } from '@/components/Lightbox'
import { Button } from '@/components/ui/button'
import { useSelection } from '@/lib/use-selection'
import { useEditPage } from '@/features/ai-images/hooks/use-edit-page'
import { createImageStorage } from '@/lib/image-storage'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/dashboard/edit/$imageId')({
  component: EditPage,
  validateSearch: (search: Record<string, unknown>) => ({
    sourceId: (search.sourceId as string) || undefined,
  }),
})

const THUMB_SIZES = ['lg', 'md', 'sm'] as const
const THUMB_LABELS: Record<(typeof THUMB_SIZES)[number], string> = {
  lg: 'LG',
  md: 'MD',
  sm: 'SM',
}

interface EditPrefs {
  thumbSize: 'lg' | 'md' | 'sm'
  showInfo: boolean
  sortAsc: boolean
}

const PREFS_KEY = 'genzen:edit-page-prefs'

function getStoredPrefs(): EditPrefs {
  if (typeof window === 'undefined')
    return { thumbSize: 'lg', showInfo: true, sortAsc: false }
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw)
      return {
        ...{ thumbSize: 'lg', showInfo: true, sortAsc: false },
        ...JSON.parse(raw),
      }
  } catch {}
  return { thumbSize: 'lg', showInfo: true, sortAsc: false }
}

function storePrefs(partial: Partial<EditPrefs>) {
  try {
    const current = getStoredPrefs()
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...partial }))
  } catch {}
}

function EditPage() {
  const { imageId } = Route.useParams()
  const { sourceId: initialSourceId } = Route.useSearch()

  const [panelPinned, setPanelPinned] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('genzen:edit-panel-pinned') !== 'false'
  })

  useEffect(() => {
    localStorage.setItem('genzen:edit-panel-pinned', String(panelPinned))
  }, [panelPinned])

  // View prefs — same controls as main view
  const [storedPrefs] = useState(getStoredPrefs)
  const [thumbSize, setThumbSize] = useState<'lg' | 'md' | 'sm'>(
    storedPrefs.thumbSize,
  )
  const [showInfo, setShowInfo] = useState(storedPrefs.showInfo)
  const [sortAsc, setSortAsc] = useState(storedPrefs.sortAsc)

  // Selection state (initialized early so it can be passed to useEditPage)
  const [selectionItems, setSelectionItems] = useState<Array<string>>([])
  const selection = useSelection({ items: selectionItems })
  const selectionActive = selection.count > 0

  const page = useEditPage(imageId, selection.selectedIds)

  const handleToggleThumbSize = () => {
    setThumbSize((v) => {
      const idx = THUMB_SIZES.indexOf(v)
      const next = THUMB_SIZES[(idx + 1) % THUMB_SIZES.length]
      storePrefs({ thumbSize: next })
      return next
    })
  }

  const handleToggleInfo = () => {
    setShowInfo((v) => {
      storePrefs({ showInfo: !v })
      return !v
    })
  }

  const handleToggleSort = () => {
    setSortAsc((v) => {
      storePrefs({ sortAsc: !v })
      return !v
    })
  }

  // Ref image picker state
  const [refPickerOpen, setRefPickerOpen] = useState(false)

  // Describe dialog
  const [describeTarget, setDescribeTarget] = useState<SavedAiImage | null>(
    null,
  )

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Sort chain images — parent always stays at position 0
  const sortedChainImages = sortAsc
    ? page.chainImages.length > 1
      ? [page.chainImages[0], ...[...page.chainImages.slice(1)].reverse()]
      : page.chainImages
    : page.chainImages

  // Update selection items when images change
  useEffect(() => {
    setSelectionItems(sortedChainImages.map((img) => img.id))
  }, [sortedChainImages])

  // Pre-select child when navigating from main page thumb click
  const didApplyInitialSource = useRef(false)
  useEffect(() => {
    if (!initialSourceId || didApplyInitialSource.current || page.pageLoading)
      return
    didApplyInitialSource.current = true
    void page.selectImageById(initialSourceId)
  }, [initialSourceId, page.pageLoading, page.selectImageById])

  // Card click = promote to source (not navigate)
  const handleOpen = useCallback(
    (img: SavedAiImage) => {
      if (img.id === page.activeSourceId) return
      void page.selectImageById(img.id)
    },
    [page.activeSourceId, page.selectImageById],
  )

  // Child thumbnail click = promote that child to source
  const handleChildOpen = useCallback(
    (childId: string) => {
      void page.selectImageById(childId)
    },
    [page.selectImageById],
  )

  // Delete — prevent deleting the current source
  const handleDelete = useCallback(
    (img: SavedAiImage) => {
      if (img.id === page.activeSourceId) return
      void page.results.deleteResult(img.id)
    },
    [page.activeSourceId, page.results.deleteResult],
  )

  // Unlink — prevent unlinking the original parent
  const handleUnlink = useCallback(
    (img: SavedAiImage) => {
      if (img.id === imageId) return
      void page.detachResult(img.id)
    },
    [imageId, page],
  )

  // Download single image
  const handleDownload = useCallback(async (img: SavedAiImage) => {
    const path = img.storage_path
    if (!path) return
    const url = await createImageStorage(supabase).getUrl(path)
    if (!url) return
    saveAs(url, `${img.title}.png`)
  }, [])

  // Batch download selected
  const handleDownloadSelected = useCallback(async () => {
    const selected = sortedChainImages.filter(
      (img) => selection.selectedIds.has(img.id) && img.storage_path,
    )
    if (selected.length === 0) return
    if (selected.length === 1) {
      await handleDownload(selected[0])
      selection.clearSelection()
      return
    }
    const zip = new JSZip()
    await Promise.all(
      selected.map(async (img) => {
        const url = await createImageStorage(supabase).getUrl(img.storage_path!)
        if (!url) return
        const resp = await fetch(url)
        const blob = await resp.blob()
        zip.file(`${img.title}.png`, blob)
      }),
    )
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, 'edit-images.zip')
    selection.clearSelection()
  }, [sortedChainImages, selection, handleDownload])

  // Batch delete selected
  const handleDeleteSelected = useCallback(async () => {
    const toDelete = Array.from(selection.selectedIds).filter(
      (id) => id !== page.activeSourceId,
    )
    await Promise.all(toDelete.map((id) => page.results.deleteResult(id)))
    selection.clearSelection()
  }, [selection, page.activeSourceId, page.results.deleteResult])

  // Batch unlink selected
  const handleUnlinkSelected = useCallback(async () => {
    const toUnlink = Array.from(selection.selectedIds).filter(
      (id) => id !== imageId, // Don't unlink the original parent
    )
    await Promise.all(toUnlink.map((id) => page.detachResult(id)))
    selection.clearSelection()
  }, [selection, imageId, page])

  // Lightbox images (completed only)
  const lightboxImages = sortedChainImages
    .filter((img) => img.status === 'completed' && page.chainImageUrls[img.id])
    .map((img) => ({
      id: img.id,
      url: page.chainImageUrls[img.id],
      title: img.title,
    }))

  const handleGallery = useCallback(
    (img: SavedAiImage) => {
      const idx = lightboxImages.findIndex((i) => i.id === img.id)
      if (idx >= 0) setLightboxIndex(idx)
    },
    [lightboxImages],
  )

  if (page.pageLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-muted-foreground">Loading image...</p>
      </div>
    )
  }

  if (!page.sourceImageMeta) {
    return (
      <div className="space-y-4">
        <Link
          to="/dashboard/ai-images"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AI Images
        </Link>
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <h3 className="mb-2 text-lg font-semibold">Image not found</h3>
          <p className="text-sm text-muted-foreground">
            {page.error ?? 'This image may have been deleted.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={panelPinned ? 'mr-80' : ''}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            to="/dashboard/ai-images"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to AI Images
          </Link>
          <div className="flex items-center gap-3">
            {/* View controls — same as main view */}
            <div className="flex items-center gap-1">
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
              <button
                onClick={handleToggleSort}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label={sortAsc ? 'Sort newest first' : 'Sort oldest first'}
              >
                {sortAsc ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={handleToggleInfo}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label={showInfo ? 'Hide info' : 'Show info'}
              >
                {showInfo ? (
                  <Info className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
            </div>

            {page.isChained && (
              <button
                onClick={page.resetToOriginal}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            )}
            {page.hasParent && (
              <button
                onClick={() => void page.detachFromParent()}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <Unlink className="h-3.5 w-3.5" />
                Detach
              </button>
            )}
            {page.credits.balance !== null && (
              <span className="text-sm text-muted-foreground tabular-nums">
                {page.credits.balance} credits
              </span>
            )}
          </div>
        </div>

        {/* Image gallery — same component as main view, scoped to edit chain */}
        <ImageGallery
          images={sortedChainImages}
          imageUrls={page.chainImageUrls}
          rootImageMeta={{}}
          editChildrenMap={{}}
          loadingGallery={false}
          thumbSize={thumbSize}
          showInfo={showInfo}
          onDelete={handleDelete}
          onRestoreRoot={() => {}}
          onDownload={handleDownload}
          onUnlink={handleUnlink}
          onDescribe={(img) => setDescribeTarget(img)}
          onGallery={handleGallery}
          onOpen={handleOpen}
          onChildOpen={handleChildOpen}
          selectionActive={selectionActive}
          isSelected={selection.isSelected}
          onSelect={(id, shiftKey) => selection.toggle(id, shiftKey)}
          activeId={page.activeSourceId}
        />
      </div>

      {/* Right sidebar */}
      <div
        className={
          panelPinned
            ? 'fixed top-0 right-0 h-screen w-80 border-l border-border bg-black/90 backdrop-blur-2xl overflow-y-auto z-30'
            : 'fixed top-0 right-0 h-screen w-80 border-l border-border bg-black/90 backdrop-blur-2xl overflow-y-auto z-30 shadow-xl'
        }
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-xs text-muted-foreground">Edit</span>
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
          </div>
        </div>
        <div className="px-4 pb-4 space-y-3">
          <GeneratorPanel
            generator={page.generator}
            modelSelector={page.modelSelector}
            credits={page.credits}
            userImages={page.existingImages}
            error={page.error}
            describe={page.describe}
            mode={selectionActive ? 'generate' : 'edit'}
            refImagesReadOnly={selectionActive}
            libraryFilterIds={new Set(sortedChainImages.map((img) => img.id))}
          />

          {/* Variations button */}
          <ActionButton
            variant="outline"
            onClick={page.handleOpenVariationDialog}
            loading={page.variationPromptsLoading}
            loadingText="Generating..."
            className="w-full"
          >
            Generate Variations
          </ActionButton>
        </div>
      </div>

      {/* Batch selection drawer — unlink, delete, download */}
      <SelectionDrawer
        count={selection.count}
        onClear={selection.clearSelection}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleUnlinkSelected()}
        >
          <Unlink className="h-4 w-4 mr-1.5" />
          Unlink
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleDownloadSelected()}
        >
          <Download className="h-4 w-4 mr-1.5" />
          Download
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleDeleteSelected()}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Delete
        </Button>
      </SelectionDrawer>

      {/* Variation prompts dialog */}
      <VariationPromptsDialog
        open={page.variationDialogOpen}
        onOpenChange={page.setVariationDialogOpen}
        prompts={page.variationPrompts}
        loading={page.variationPromptsLoading}
        onGenerate={(guidance, count) =>
          void page.handleGenerateVariations(guidance, count)
        }
        onApply={(prompts) => {
          page.generator.pastePrompts(prompts)
          page.setVariationDialogOpen(false)
        }}
        sourceImageUrl={page.sourceImageMeta.url}
        referenceImages={page.generator.refImages}
        onAddReference={() => setRefPickerOpen(true)}
        onRemoveReference={(id) => page.generator.removeRefImage(id)}
      />

      {/* Ref image picker */}
      <ExistingImagePicker
        open={refPickerOpen}
        onOpenChange={setRefPickerOpen}
        images={page.existingImages.images}
        imageUrls={page.existingImages.imageUrls}
        isLoading={page.existingImages.isLoading}
        alreadyCollectedIds={new Set(page.generator.refImages.map((r) => r.id))}
        onConfirm={(selected) =>
          page.generator.addRefImages(
            selected.map((s) => ({
              id: s.id,
              url: s.url,
              title: s.title,
            })),
          )
        }
        max={page.generator.maxRefImages - page.generator.refImages.length}
      />

      {/* Describe dialog */}
      {describeTarget && (
        <DescribeDialog
          open={!!describeTarget}
          onOpenChange={(open) => {
            if (!open) setDescribeTarget(null)
          }}
          imageUrl={page.chainImageUrls[describeTarget.id]}
          imageId={describeTarget.id}
          currentDescription={describeTarget.description}
          accessToken={page.accessToken ?? undefined}
        />
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          imageUrls={page.chainImageUrls}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNext={() =>
            setLightboxIndex((i) =>
              i === null ? 0 : (i + 1) % lightboxImages.length,
            )
          }
          onPrev={() =>
            setLightboxIndex((i) =>
              i === null
                ? 0
                : (i - 1 + lightboxImages.length) % lightboxImages.length,
            )
          }
          onDelete={() => {
            const img = lightboxImages[lightboxIndex]
            void page.results.deleteResult(img.id)
            if (lightboxImages.length <= 1) {
              setLightboxIndex(null)
            } else if (lightboxIndex >= lightboxImages.length - 1) {
              setLightboxIndex(lightboxIndex - 1)
            }
          }}
        />
      )}
    </div>
  )
}
