'use client'

import { useCallback, useEffect, useState } from 'react'
import { layoutMasonry } from '../_lib/masonry'
import { addToCanvas, preloadUrl, readLocalImage } from '../_lib/persistence'
import type { CollectedImage, UserImage } from '#/features/user-images'
import type { CanvasImage } from '../_lib/types'
import { imageUrl } from '#/lib/image-url'
import { computeFileHash } from '#/features/user-images/lib/file-hash'

/** Column width used when more than one image arrives at once; a lone image
 *  keeps its natural width. */
const MULTI_COLUMN_WIDTH = 300
const COLUMNS = 6
const DROP_NOTICE_MS = 3000
const IMAGE_URL_PATTERN = /\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?.*)?$/i

interface CreatedRecord {
  id: string
  storage_path?: string | null
}

interface UseIngestArgs {
  canvasId: string
  setImages: React.Dispatch<React.SetStateAction<Array<CanvasImage>>>
  select: (next: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  pushUndo: () => void
  /** Where a paste lands: the last click, else the viewport centre. */
  getPasteTarget: () => { x: number; y: number }
  screenToCanvas: (sx: number, sy: number) => { x: number; y: number }
  createImage: (input: {
    title: string
    file: File
    file_hash: string
  }) => Promise<CreatedRecord>
  libraryImages: Array<UserImage>
}

/** Everything that puts a new card on the canvas: upload (paste, drop, file
 *  picker) and the library picker.
 *
 *  Both write membership *and* position eagerly rather than waiting for the
 *  debounced save, so a card is reclaimable at the right spot even if the page
 *  reloads a moment later. */
export function useIngest({
  canvasId,
  setImages,
  select,
  pushUndo,
  getPasteTarget,
  screenToCanvas,
  createImage,
  libraryImages,
}: UseIngestArgs) {
  const [dropNotice, setDropNotice] = useState<string | null>(null)

  const addImagesFromFiles = useCallback(
    async (files: FileList | Array<File>, cx: number, cy: number) => {
      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith('image/'),
      )
      if (imageFiles.length === 0) return

      // Dimensions *and* the bytes come from object URLs -- instant, no upload
      // needed -- so the card lands at the right size showing the actual image.
      const local = await Promise.all(
        imageFiles.map(async (file) => ({
          file,
          ...(await readLocalImage(file)),
        })),
      )

      const items = local.map(({ w, h }) => ({
        id: crypto.randomUUID(),
        width: w,
        height: h,
      }))
      const placedImages: Array<CanvasImage> = layoutMasonry(
        items,
        COLUMNS,
        cx,
        cy,
        items.length === 1 ? undefined : MULTI_COLUMN_WIDTH,
      ).map((r, i) => ({
        ...r,
        recordId: '',
        storagePath: '',
        // Not `pending`: pending means there is nothing to show. Here the image
        // is already in memory, so the upload happens under a real card.
        uploading: true,
        signedUrl: local[i].url,
      }))

      pushUndo()
      setImages((prev) => [...prev, ...placedImages])
      select(new Set(placedImages.map((img) => img.id)))

      // Upload in parallel, settling each card as it completes.
      await Promise.all(
        local.map(async ({ file, url: objectUrl }, i) => {
          const placeholder = placedImages[i]
          try {
            const record = await createImage({
              title: file.name || 'Canvas Image',
              file,
              file_hash: await computeFileHash(file),
            })
            if (!record.storage_path) {
              throw new Error('Created image is missing a storage path')
            }
            const storagePath = record.storage_path
            const signedUrl = imageUrl(record.id)

            // Decode the hosted image before swapping `src`, or the card blinks
            // empty at the exact moment it is supposed to be settling.
            await preloadUrl(signedUrl)

            setImages((prev) =>
              prev.map((ci) =>
                ci.id === placeholder.id
                  ? {
                      ...ci,
                      recordId: record.id,
                      storagePath,
                      signedUrl,
                      uploading: false,
                    }
                  : ci,
              ),
            )
            URL.revokeObjectURL(objectUrl)
            void addToCanvas(canvasId, [
              {
                imageId: record.id,
                x: placeholder.x,
                y: placeholder.y,
                width: placeholder.width,
                height: placeholder.height,
              },
            ])
          } catch {
            URL.revokeObjectURL(objectUrl)
            setImages((prev) => prev.filter((ci) => ci.id !== placeholder.id))
          }
        }),
      )
    },
    [pushUndo, setImages, select, createImage, canvasId],
  )

  /** Fetch a remote image and route it through the upload path. */
  const addImageFromUrl = useCallback(
    (
      url: string,
      x: number,
      y: number,
      filename: string,
      onError?: () => void,
    ) => {
      fetch(url)
        .then((r) => r.blob())
        .then((blob) => {
          const file = new File([blob], filename, {
            type: blob.type || 'image/png',
          })
          return addImagesFromFiles([file], x, y)
        })
        .catch(() => onError?.())
    },
    [addImagesFromFiles],
  )

  /* -- Paste -- */
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      // A clipboard image file: screenshots, copies, HTML img pastes.
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          e.preventDefault()
          const c = getPasteTarget()
          void addImagesFromFiles([file], c.x, c.y)
          return
        }
      }

      // Otherwise a pasted URL -- fetch and upload it.
      const text = e.clipboardData.getData('text/plain')
      if (IMAGE_URL_PATTERN.test(text)) {
        e.preventDefault()
        const c = getPasteTarget()
        addImageFromUrl(text, c.x, c.y, 'pasted-image.png')
      }
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [addImagesFromFiles, addImageFromUrl, getPasteTarget])

  /* -- Drop -- */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const pos = screenToCanvas(e.clientX, e.clientY)

      if (e.dataTransfer.files.length > 0) {
        void addImagesFromFiles(e.dataTransfer.files, pos.x, pos.y)
        return
      }

      const html = e.dataTransfer.getData('text/html')
      const urlMatch = html.match(/<img[^>]+src="([^"]+)"/)
      const url = urlMatch?.[1] || e.dataTransfer.getData('text/plain') || ''
      if (!url.startsWith('http')) return

      addImageFromUrl(url, pos.x, pos.y, 'dropped-image.png', () => {
        setDropNotice(
          "Couldn't load that image. Try copying it and pasting instead.",
        )
        setTimeout(() => setDropNotice(null), DROP_NOTICE_MS)
      })
    },
    [screenToCanvas, addImagesFromFiles, addImageFromUrl],
  )

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files?.length) return
      const c = getPasteTarget()
      void addImagesFromFiles(e.target.files, c.x, c.y)
      e.target.value = ''
    },
    [addImagesFromFiles, getPasteTarget],
  )

  /* -- Library picker -- */
  const onLibraryConfirm = useCallback(
    async (selectedImages: Array<CollectedImage>) => {
      if (selectedImages.length === 0) return
      const c = getPasteTarget()

      const resolved = await Promise.all(
        selectedImages.map(async (item) => {
          const record = libraryImages.find((img) => img.id === item.id)
          if (!record?.storage_path) return null
          const signedUrl = imageUrl(record.id)

          // Dimensions from the full-res URL, so the card is the right shape.
          const dims = await new Promise<{ w: number; h: number }>(
            (resolve) => {
              const img = new Image()
              img.onload = () =>
                resolve({ w: img.naturalWidth, h: img.naturalHeight })
              img.onerror = () => resolve({ w: 300, h: 300 })
              img.src = signedUrl
            },
          )
          return {
            recordId: record.id,
            storagePath: record.storage_path,
            signedUrl,
            ...dims,
          }
        }),
      )

      const valid = resolved.filter((r) => r !== null)
      if (valid.length === 0) return

      const items = valid.map(({ w, h }) => ({
        id: crypto.randomUUID(),
        width: w,
        height: h,
      }))
      const newImages: Array<CanvasImage> = layoutMasonry(
        items,
        COLUMNS,
        c.x,
        c.y,
        items.length === 1 ? undefined : MULTI_COLUMN_WIDTH,
      ).map((r, i) => ({
        ...r,
        recordId: valid[i].recordId,
        storagePath: valid[i].storagePath,
        signedUrl: valid[i].signedUrl,
      }))

      pushUndo()
      setImages((prev) => [...prev, ...newImages])
      select(new Set(newImages.map((img) => img.id)))
      void addToCanvas(
        canvasId,
        newImages.map((img) => ({
          imageId: img.recordId,
          x: img.x,
          y: img.y,
          width: img.width,
          height: img.height,
        })),
      )
    },
    [pushUndo, setImages, select, getPasteTarget, libraryImages, canvasId],
  )

  return {
    dropNotice,
    addImagesFromFiles,
    onDragOver,
    onDrop,
    onFileChange,
    onLibraryConfirm,
  }
}
