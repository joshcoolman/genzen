/**
 * User Images Display Component
 *
 * Main container component that orchestrates the entire user images feature.
 */

import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { ImageUploadButton } from './ImageUploadButton'
import { ImageGrid, EmptyState } from './ImageGrid'
import { ImageCard } from './ImageCard'
import { ImageEditDialog } from './ImageEditDialog'
import { useUserImages } from '../hooks/useUserImages'
import type { CreateUserImageInput } from '../types'

/**
 * User images display component
 */
export function UserImagesDisplay() {
  const { user } = useAuth()
  const {
    images,
    imageUrls,
    isLoading,
    isCreating,
    isDeleting,
    isUpdating,
    error,
    create,
    update,
    deleteImage,
    clearError,
  } = useUserImages(user?.id)

  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const handleUpload = async (input: CreateUserImageInput) => {
    await create(input)
  }

  const handleUpdate = async (
    id: string,
    title: string,
    description: string | null,
  ) => {
    await update(id, title, description)
  }

  const handleDelete = (id: string) => {
    deleteImage(id)
  }

  const handleOpenEdit = (index: number) => {
    setEditingIndex(index)
  }

  const handleCloseEdit = () => {
    setEditingIndex(null)
  }

  const handleNextImage = () => {
    if (editingIndex === null) return
    const nextIndex = editingIndex + 1
    if (nextIndex < images.length) {
      setEditingIndex(nextIndex)
    } else {
      setEditingIndex(0)
    }
  }

  const editingImage =
    editingIndex !== null ? (images[editingIndex] ?? null) : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="mb-4 text-2xl text-muted-foreground">Loading...</div>
          <p className="text-muted-foreground">Loading images...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Images</h2>
          <p className="text-sm text-muted-foreground">
            {images.length} {images.length === 1 ? 'image' : 'images'}
          </p>
        </div>

        <ImageUploadButton onUpload={handleUpload} isUploading={isCreating} />
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="text-sm underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Image Grid or Empty State */}
      {images.length > 0 ? (
        <ImageGrid>
          {images.map((image, index) => (
            <ImageCard
              key={image.id}
              image={image}
              imageUrl={imageUrls[image.id] || ''}
              onClick={() => handleOpenEdit(index)}
              onDelete={handleDelete}
              isDeleting={isDeleting === image.id}
              isUpdating={isUpdating === image.id}
            />
          ))}
        </ImageGrid>
      ) : (
        <EmptyState />
      )}

      {/* Edit Dialog */}
      <ImageEditDialog
        image={editingImage}
        imageUrl={editingImage ? imageUrls[editingImage.id] || '' : ''}
        open={editingIndex !== null}
        onClose={handleCloseEdit}
        onSave={handleUpdate}
        onNext={handleNextImage}
        userId={user?.id || ''}
      />
    </div>
  )
}
