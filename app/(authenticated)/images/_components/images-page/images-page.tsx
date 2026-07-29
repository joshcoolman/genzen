'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Info,
  LayoutGrid,
  Pin,
  PinOff,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { saveAs } from 'file-saver'
import { GeneratorPanel } from '../../../_components/generator-panel/generator-panel'
import { ImageGallery } from '../../../_components/image-gallery/image-gallery'
import { VariationPromptsDialog } from '../../../_components/variation-prompts-dialog/variation-prompts-dialog'
import { DescribeDialog } from '../../../_components/describe-dialog/describe-dialog'
import { ImageLightbox } from '../image-lightbox/image-lightbox'
import styles from './images-page.module.css'
import type { SavedAiImage } from '#/features/ai-images/types'
import { usePersistedState } from '#/lib/use-persisted-state'
import { useIsMobile } from '#/lib/hooks/use-is-mobile'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  MobileDialogHeader,
  SelectionDrawer,
} from '#/components'
import { useImagesPage } from '#/features/ai-images/index'
import { useImageUpload } from '#/features/user-images/hooks/useImageUpload'
import { createImageStorage } from '#/lib/image-storage'
import { useSelection } from '#/lib/use-selection'
import { cx } from '#/lib/utils'

const THUMB_SIZES = ['lg', 'md', 'sm'] as const
const THUMB_LABELS: Record<(typeof THUMB_SIZES)[number], string> = {
  lg: 'LG',
  md: 'MD',
  sm: 'SM',
}

interface ImagesPrefs {
  thumbSize: 'lg' | 'md' | 'sm'
  sortAsc: boolean
  showInfo: boolean
}

const PREFS_KEY = 'genzen:ai-images-prefs'

const DEFAULT_PREFS: ImagesPrefs = {
  thumbSize: 'lg',
  sortAsc: false,
  showInfo: true,
}

// Only ever called from an effect, never during render -- see usePersistedState.
function getStoredPrefs(): ImagesPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return DEFAULT_PREFS
}

function storePrefs(partial: Partial<ImagesPrefs>) {
  try {
    const current = getStoredPrefs()
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...partial }))
  } catch {
    // ignore
  }
}

export function ImagesPage() {
  const page = useImagesPage()
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

  // Batch delete
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  const batchSelectedImages = useCallback(() => {
    return sortedImages.filter((img) => selection.selectedIds.has(img.id))
  }, [sortedImages, selection.selectedIds])

  const handleBatchDelete = useCallback(async () => {
    const images = batchSelectedImages()
    setIsBatchDeleting(true)
    try {
      for (const img of images) await page.gallery.deleteImage(img)
      selection.clearSelection()
    } finally {
      setIsBatchDeleting(false)
    }
  }, [batchSelectedImages, page.gallery, selection])

  // Download: two-step flow — dialog for name, then build + save
  const [downloadTarget, setDownloadTarget] = useState<SavedAiImage | null>(
    null,
  )
  const [downloadName, setDownloadName] = useState('')
  // Base UI focuses the popup itself on open, so the name field has to be named
  // explicitly -- `autoFocus` on the Input is a no-op inside a focus trap, and
  // silently so: the Enter-to-download path would just be unreachable.
  const downloadNameRef = useRef<HTMLInputElement>(null)
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
      const url = await createImageStorage().getUrl(storagePath)
      if (!url) return
      const response = await fetch(url)
      const blob = await response.blob()
      saveAs(blob, `${baseName}${extOf(storagePath)}`)
    } finally {
      setDownloading(false)
      setDownloadTarget(null)
    }
  }, [downloadTarget, downloadName])

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
      className={cx(
        styles.page,
        generatorOpen && panelPinned && styles.pagePushed,
      )}
    >
      <div className={styles.body}>
        <div className={styles.toolbar}>
          <span className={styles.heading}>Images</span>
          <div className={styles.tools}>
            {/* Thumb size toggle */}
            <button
              onClick={handleToggleThumbSize}
              className={cx(styles.viewToggle, styles.thumbSizeToggle)}
              aria-label={`Thumbnail size: ${THUMB_LABELS[thumbSize]}`}
            >
              <LayoutGrid className={styles.smallIcon} />
              <span className={styles.thumbSizeLabel}>
                {THUMB_LABELS[thumbSize]}
              </span>
            </button>

            {/* Sort toggle */}
            <button
              onClick={handleToggleSort}
              className={styles.viewToggle}
              aria-label={sortAsc ? 'Sort oldest first' : 'Sort newest first'}
            >
              {sortAsc ? (
                <ArrowUp className={styles.toolbarIcon} />
              ) : (
                <ArrowDown className={styles.toolbarIcon} />
              )}
            </button>

            {/* Info toggle */}
            <button
              onClick={handleToggleInfo}
              className={cx(styles.viewToggle, showInfo && styles.viewToggleOn)}
              aria-label={showInfo ? 'Hide info' : 'Show info'}
            >
              <Info className={styles.toolbarIcon} />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className={styles.fileInput}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? [])
                if (files.length > 0) void handleUploadFiles(files)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={styles.action}
              title="Upload image"
            >
              <Upload className={styles.toolbarIcon} />
            </button>
            {!generatorOpen && (
              <button
                onClick={() => setGeneratorOpen(true)}
                className={cx(styles.action, styles.actionPrimary)}
                title="New generation"
              >
                <Plus className={styles.toolbarIcon} />
              </button>
            )}
          </div>
        </div>

        <ImageGallery
          images={sortedImages}
          imageUrls={page.gallery.imageUrls}
          loadingGallery={page.gallery.loadingGallery}
          thumbSize={effectiveThumbSize}
          showInfo={showInfo}
          onLoadPrompt={page.handleLoadPrompt}
          onLoadPromptAndModel={page.handleLoadPromptAndModel}
          onDelete={page.gallery.deleteImage}
          onRetry={page.gallery.retryImage}
          onDownload={handleDownload}
          onDescribe={handleDescribe}
          onGenerateVariations={page.variations.openVariationDialog}
          onGallery={page.lightbox.open}
          onOpen={page.toggleHighlight}
          activeId={page.selectedImageId ?? undefined}
          selectionActive={selection.count > 0}
          isSelected={selection.isSelected}
          onSelect={selection.toggle}
        />

        <SelectionDrawer
          count={selection.count}
          onClear={selection.clearSelection}
        >
          <Button
            variant="danger"
            size="sm"
            disabled={isBatchDeleting}
            onClick={() => void handleBatchDelete()}
          >
            <Trash2 className={styles.actionIcon} />
            {isBatchDeleting ? 'Deleting...' : `Delete (${selection.count})`}
          </Button>
        </SelectionDrawer>
      </div>

      {/* Generator panel — full-screen dialog on mobile, right sidebar on desktop */}
      {isMobile ? (
        <Dialog open={generatorOpen} onOpenChange={setGeneratorOpen}>
          <DialogContent size="fullscreen" showCloseButton={false}>
            <MobileDialogHeader
              title="Generate"
              onClose={() => setGeneratorOpen(false)}
            />
            <div className={styles.mobilePanelBody}>
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
              className={styles.dismissLayer}
              onClick={() => setGeneratorOpen(false)}
            />
          )}

          {/* Right sidebar generator panel */}
          {generatorOpen && (
            <div
              className={cx(styles.panel, !panelPinned && styles.panelFloating)}
            >
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>Generate</span>
                <div className={styles.panelHeaderActions}>
                  <button
                    onClick={() => setPanelPinned((p) => !p)}
                    className={styles.panelButton}
                    title={panelPinned ? 'Unpin (overlay)' : 'Pin (inline)'}
                  >
                    {panelPinned ? (
                      <Pin className={styles.smallIcon} />
                    ) : (
                      <PinOff className={styles.smallIcon} />
                    )}
                  </button>
                  <button
                    onClick={() => setGeneratorOpen(false)}
                    className={styles.panelButton}
                  >
                    <X className={styles.smallIcon} />
                  </button>
                </div>
              </div>
              <div className={styles.panelBody}>
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
            const img = page.completedImages.find((i) => i.id === item.id)
            page.lightbox.close()
            if (img) page.toggleHighlight(img)
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
        <DialogContent
          className={styles.downloadPopup}
          initialFocus={downloadNameRef}
        >
          <DialogHeader>
            <DialogTitle>Download</DialogTitle>
          </DialogHeader>
          <Input
            ref={downloadNameRef}
            value={downloadName}
            onChange={(e) => setDownloadName(e.target.value)}
            placeholder="Name..."
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
              variant="primary"
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
    </div>
  )
}
