'use client'

import { ExistingImagePicker } from '../_components/existing-image-picker/existing-image-picker'
import { getBounds } from './_lib/geometry'
import { CANVAS_MAX_GROUP_SELECTION } from './_lib/canvas-models'
import { useView } from './use-view'
import { SelectionActions } from './_components/selection-actions/selection-actions'
import { CanvasSurface } from './_components/canvas-surface/canvas-surface'
import { ImageCard } from './_components/image-card/image-card'
import { GroupBackground } from './_components/group-background/group-background'
import { ModelLabel } from './_components/model-label/model-label'
import { PendingOverlay } from './_components/pending-overlay/pending-overlay'
import { SelectionBounds } from './_components/selection-bounds/selection-bounds'
import { GeneratePill } from './_components/generate-pill/generate-pill'
import { MarqueeBox } from './_components/marquee-box/marquee-box'
import { EmptyPrompt } from './_components/empty-prompt/empty-prompt'
import { ContextMenu } from './_components/context-menu/context-menu'
import { DeleteConfirm } from './_components/delete-confirm/delete-confirm'
import { DropNotice } from './_components/drop-notice/drop-notice'
import { CanvasGenerateDialog } from './_components/canvas-generate-dialog/canvas-generate-dialog'
import type { CanvasState } from './_lib/persistence'
import type { CanvasImage } from './_lib/types'
import { getModelName } from '#/features/ai-images/models'

/** Below this zoom the screen-space labels are noise, so they are dropped. */
const MODEL_LABEL_MIN_SCALE = 0.1
/** Label sits this far above its card, in screen pixels. */
const MODEL_LABEL_OFFSET = 22
/** The selection box is drawn slightly outside the content it wraps. */
const SELECTION_INSET = 6
/** Gap between the selection box and the Generate pill below it. */
const PILL_GAP = 10
/** Nothing is ever "already collected" on the canvas -- a library image can be
 *  placed more than once, so the picker never greys anything out. */
const NONE_COLLECTED = new Set<string>()

interface ViewProps {
  /** The canvas as the server read it. Seeds the first render, so there is no
   *  loading gate and no empty first paint (#212). */
  initial: CanvasState
}

export function View({ initial }: ViewProps) {
  const {
    images,
    groups,
    selected,
    transform,
    marquee,
    spaceHeld,
    contextMenu,
    setContextMenu,
    deleteConfirm,
    setDeleteConfirm,
    dropNotice,
    containerRef,
    fileInputRef,
    canvasGen,
    libraryOpen,
    setLibraryOpen,
    libraryImages,
    libraryImageUrls,
    libraryLoading,
    onLibraryConfirm,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onContextMenu,
    onDragOver,
    onDrop,
    onFileChange,
    getSelectedGroup,
    arrangeSelected,
    groupSelected,
    ungroupSelected,
    removeSelectionFromCanvas,
    moveSelectionToTrash,
    dismissFailed,
  } = useView(initial)

  const selectionBounds =
    selected.size >= 1
      ? getBounds(images.filter((img) => selected.has(img.id)))
      : null

  /** Canvas point -> screen point, for the overlays outside the plane. */
  const toScreen = (x: number, y: number) => ({
    left: transform.x + x * transform.scale,
    top: transform.y + y * transform.scale,
  })

  /** Inside a live multi-selection's box but not in it -- about to be left
   *  behind by the drag, so the card dims. */
  const isDimmed = (img: CanvasImage) =>
    selected.size >= 2 &&
    !!selectionBounds &&
    !selected.has(img.id) &&
    img.x + img.width >= selectionBounds.x &&
    img.x <= selectionBounds.x + selectionBounds.w &&
    img.y + img.height >= selectionBounds.y &&
    img.y <= selectionBounds.y + selectionBounds.h

  // The pill needs a settled, fully-loaded selection: nothing still pending or
  // uploading (an uploading card has no row to send yet, even though it draws),
  // and small enough that some model can hold every image as a reference.
  const pillImages = images.filter((img) => selected.has(img.id))
  const showPill =
    selected.size >= 1 &&
    selected.size <= CANVAS_MAX_GROUP_SELECTION &&
    !canvasGen.isOpen &&
    pillImages.length === selected.size &&
    !pillImages.some((img) => img.pending || img.uploading)

  const containerRect = containerRef.current?.getBoundingClientRect()

  return (
    <>
      <CanvasSurface
        containerRef={containerRef}
        transform={transform}
        panMode={spaceHeld}
        onPointerDown={(e) => {
          if (contextMenu) setContextMenu(null)
          onPointerDown(e)
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onContextMenu={onContextMenu}
        plane={
          <>
            {groups.map((group) => {
              const members = images.filter((img) =>
                group.imageIds.includes(img.id),
              )
              if (members.length < 2) return null
              return (
                <GroupBackground
                  key={group.id}
                  groupId={group.id}
                  bounds={getBounds(members)}
                  padding={group.padding}
                />
              )
            })}
            {images.map((img) => (
              <ImageCard
                key={img.id}
                image={img}
                dimmed={isDimmed(img)}
                scale={transform.scale}
                onRetry={(id) => void canvasGen.retryFailed(id)}
                onDismiss={dismissFailed}
              />
            ))}
          </>
        }
      >
        {images
          .filter(
            (img) =>
              transform.scale >= MODEL_LABEL_MIN_SCALE &&
              !img.pending &&
              !img.failed &&
              img.model,
          )
          .map((img) => {
            const at = toScreen(img.x, img.y)
            return (
              <ModelLabel
                key={`label-${img.id}`}
                name={getModelName(img.model!)}
                left={at.left}
                top={at.top - MODEL_LABEL_OFFSET}
              />
            )
          })}

        {images
          .filter((img) => img.pending)
          .map((img) => {
            const at = toScreen(img.x + img.width / 2, img.y + img.height / 2)
            return (
              <PendingOverlay
                key={`loading-${img.id}`}
                left={at.left}
                top={at.top}
                modelName={
                  img.model && transform.scale > MODEL_LABEL_MIN_SCALE
                    ? getModelName(img.model)
                    : undefined
                }
              />
            )
          })}

        {selectionBounds && (
          <SelectionBounds
            left={
              transform.x +
              selectionBounds.x * transform.scale -
              SELECTION_INSET
            }
            top={
              transform.y +
              selectionBounds.y * transform.scale -
              SELECTION_INSET
            }
            width={selectionBounds.w * transform.scale + SELECTION_INSET * 2}
            height={selectionBounds.h * transform.scale + SELECTION_INSET * 2}
          />
        )}

        {showPill && selectionBounds && (
          <GeneratePill
            left={
              transform.x +
              (selectionBounds.x + selectionBounds.w / 2) * transform.scale
            }
            top={
              transform.y +
              (selectionBounds.y + selectionBounds.h) * transform.scale +
              PILL_GAP
            }
            count={pillImages.length}
            onClick={() => void canvasGen.open(pillImages)}
          />
        )}

        {marquee && (
          <MarqueeBox
            left={Math.min(marquee.x1, marquee.x2) - (containerRect?.left ?? 0)}
            top={Math.min(marquee.y1, marquee.y2) - (containerRect?.top ?? 0)}
            width={Math.abs(marquee.x2 - marquee.x1)}
            height={Math.abs(marquee.y2 - marquee.y1)}
          />
        )}

        {images.length === 0 && <EmptyPrompt />}

        <SelectionActions
          count={selected.size}
          isGrouped={!!getSelectedGroup()}
          onArrange={arrangeSelected}
          onGroup={groupSelected}
          onUngroup={ungroupSelected}
          zoomPct={Math.round(transform.scale * 100)}
          onUpload={() => fileInputRef.current?.click()}
          onLibrary={() => setLibraryOpen(true)}
        />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={onFileChange}
          hidden
        />
      </CanvasSurface>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onGenerate={() => {
            const source = images.find((img) => img.id === contextMenu.imageId)
            if (source) void canvasGen.open([source])
            setContextMenu(null)
          }}
          onTrash={() => {
            const id = contextMenu.imageId
            setContextMenu(null)
            moveSelectionToTrash([id])
          }}
        />
      )}

      <CanvasGenerateDialog canvasGen={canvasGen} />

      <DeleteConfirm
        pending={deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onRemoveFromCanvas={removeSelectionFromCanvas}
        onMoveToTrash={moveSelectionToTrash}
      />

      <ExistingImagePicker
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        images={libraryImages}
        imageUrls={libraryImageUrls}
        isLoading={libraryLoading}
        alreadyCollectedIds={NONE_COLLECTED}
        onConfirm={onLibraryConfirm}
      />

      {dropNotice && <DropNotice message={dropNotice} />}
    </>
  )
}
