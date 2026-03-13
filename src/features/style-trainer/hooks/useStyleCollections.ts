import { useCallback, useEffect, useState } from 'react'
import { createStyle } from '../server/create-style.server'
import { getStyleImages, getStyles } from '../server/get-styles.server'
import { saveStyleImage } from '../server/save-style-image.server'
import { deleteStyle } from '../server/delete-style.server'
import { removeStyleImage } from '../server/remove-style-image.server'
import type { SelectedImage } from '@/components/LibraryPickerButton'
import { useExistingImages } from '@/features/user-images/hooks/useExistingImages'
import { useAuth } from '@/lib/auth'

export interface StyleCollection {
  id: string
  name: string
  thumbnail_path: string | null
  thumbnailUrl: string | null
  image_count: number
  created_at: string
}

export interface StyleImage {
  id: string
  style_id: string
  storage_path: string
  sort_order: number
  source: string
  url: string | null
}

type View = 'library' | 'create' | 'edit'

export interface UseStyleCollectionsReturn {
  view: View
  styles: Array<StyleCollection>
  isLoading: boolean
  editingStyle: StyleCollection | null
  editingImages: Array<StyleImage>
  editingImagesLoading: boolean
  newStyleName: string
  saving: boolean
  existingImages: ReturnType<typeof useExistingImages>
  setNewStyleName: (name: string) => void
  startCreate: () => void
  startEdit: (style: StyleCollection) => void
  backToLibrary: () => void
  saveNewStyle: () => Promise<void>
  addFileToStyle: (file: File, styleId: string) => Promise<void>
  addLibraryImageToStyle: (
    image: SelectedImage,
    styleId: string,
  ) => Promise<void>
  addLibraryImagesToStyle: (
    images: Array<SelectedImage>,
    styleId: string,
  ) => Promise<void>
  removeImage: (styleId: string, imageId: string) => Promise<void>
  deleteCollection: (styleId: string) => Promise<void>
  refreshStyles: () => Promise<void>
}

export function useStyleCollections(): UseStyleCollectionsReturn {
  const { user, session } = useAuth()
  const existingImages = useExistingImages(user?.id)

  const [view, setView] = useState<View>('library')
  const [styles, setStyles] = useState<Array<StyleCollection>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingStyle, setEditingStyle] = useState<StyleCollection | null>(null)
  const [editingImages, setEditingImages] = useState<Array<StyleImage>>([])
  const [editingImagesLoading, setEditingImagesLoading] = useState(false)
  const [newStyleName, setNewStyleName] = useState('')
  const [saving, setSaving] = useState(false)

  const accessToken = session?.access_token ?? ''

  const refreshStyles = useCallback(async () => {
    if (!accessToken) return
    setIsLoading(true)
    try {
      const result = await getStyles({ data: { accessToken } })
      setStyles(result.styles as Array<StyleCollection>)
    } catch (err) {
      console.error('Failed to load styles:', err)
    } finally {
      setIsLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    refreshStyles()
  }, [refreshStyles])

  const loadStyleImages = useCallback(
    async (styleId: string) => {
      if (!accessToken) return
      setEditingImagesLoading(true)
      try {
        const result = await getStyleImages({
          data: { accessToken, styleId },
        })
        setEditingImages(result.images as Array<StyleImage>)
      } catch (err) {
        console.error('Failed to load style images:', err)
      } finally {
        setEditingImagesLoading(false)
      }
    },
    [accessToken],
  )

  const startCreate = useCallback(() => {
    setNewStyleName('')
    setView('create')
  }, [])

  const startEdit = useCallback(
    (style: StyleCollection) => {
      setEditingStyle(style)
      setEditingImages([])
      setView('edit')
      loadStyleImages(style.id)
    },
    [loadStyleImages],
  )

  const backToLibrary = useCallback(() => {
    setView('library')
    setEditingStyle(null)
    setEditingImages([])
    setNewStyleName('')
    refreshStyles()
  }, [refreshStyles])

  const saveNewStyle = useCallback(async () => {
    if (!accessToken || !newStyleName.trim()) return
    setSaving(true)
    try {
      const result = await createStyle({
        data: { accessToken, name: newStyleName.trim() },
      })
      const newCollection = {
        ...result.style,
        thumbnailUrl: null,
      } as StyleCollection
      setEditingStyle(newCollection)
      setEditingImages([])
      setView('edit')
      await refreshStyles()
    } catch (err) {
      console.error('Failed to create style:', err)
    } finally {
      setSaving(false)
    }
  }, [accessToken, newStyleName, refreshStyles])

  const addFileToStyle = useCallback(
    async (file: File, styleId: string) => {
      if (!accessToken) return
      const buffer = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(buffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          '',
        ),
      )
      try {
        const result = await saveStyleImage({
          data: {
            accessToken,
            styleId,
            fileBase64: base64,
            fileName: file.name,
            mimeType: file.type || 'image/jpeg',
            source: 'upload',
          },
        })
        setEditingImages((prev) => [...prev, result.image as StyleImage])
        await refreshStyles()
      } catch (err) {
        console.error('Failed to upload image:', err)
      }
    },
    [accessToken, refreshStyles],
  )

  const addLibraryImageToStyle = useCallback(
    async (image: SelectedImage, styleId: string) => {
      if (!accessToken) return
      // Look up storage_path from existingImages
      const sourceRow = existingImages.images.find((img) => img.id === image.id)
      if (!sourceRow?.storage_path) {
        console.error('No storage_path found for library image:', image.id)
        return
      }
      try {
        const result = await saveStyleImage({
          data: {
            accessToken,
            styleId,
            sourceStoragePath: sourceRow.storage_path,
            source: 'library',
          },
        })
        setEditingImages((prev) => [...prev, result.image as StyleImage])
        await refreshStyles()
      } catch (err) {
        console.error('Failed to add library image:', err)
      }
    },
    [accessToken, existingImages.images, refreshStyles],
  )

  const addLibraryImagesToStyle = useCallback(
    async (images: Array<SelectedImage>, styleId: string) => {
      for (const image of images) {
        await addLibraryImageToStyle(image, styleId)
      }
    },
    [addLibraryImageToStyle],
  )

  const removeImageFn = useCallback(
    async (styleId: string, imageId: string) => {
      if (!accessToken) return
      try {
        await removeStyleImage({ data: { accessToken, styleId, imageId } })
        setEditingImages((prev) => prev.filter((img) => img.id !== imageId))
        await refreshStyles()
      } catch (err) {
        console.error('Failed to remove image:', err)
      }
    },
    [accessToken, refreshStyles],
  )

  const deleteCollectionFn = useCallback(
    async (styleId: string) => {
      if (!accessToken) return
      try {
        await deleteStyle({ data: { accessToken, styleId } })
        setStyles((prev) => prev.filter((s) => s.id !== styleId))
        if (editingStyle?.id === styleId) {
          backToLibrary()
        }
      } catch (err) {
        console.error('Failed to delete style:', err)
      }
    },
    [accessToken, editingStyle, backToLibrary],
  )

  return {
    view,
    styles,
    isLoading,
    editingStyle,
    editingImages,
    editingImagesLoading,
    newStyleName,
    saving,
    existingImages,
    setNewStyleName,
    startCreate,
    startEdit,
    backToLibrary,
    saveNewStyle,
    addFileToStyle,
    addLibraryImageToStyle,
    addLibraryImagesToStyle,
    removeImage: removeImageFn,
    deleteCollection: deleteCollectionFn,
    refreshStyles,
  }
}
