import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import type { UseStyleCollectionsReturn } from '../hooks/useStyleCollections'
import { ActionButton } from '@/components/ActionButton'
import { EmptyStateCard } from '@/components/EmptyStateCard'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { RemoveButton } from '@/components/RemoveButton'

interface StyleTrainerPageContentProps {
  page: UseStyleCollectionsReturn
}

export function StyleTrainerPageContent({
  page,
}: StyleTrainerPageContentProps) {
  return (
    <div className="space-y-6">
      {page.view === 'library' && <LibraryView page={page} />}
      {page.view === 'create' && <CreateView page={page} />}
      {page.view === 'edit' && <EditView page={page} />}
    </div>
  )
}

function LibraryView({ page }: { page: UseStyleCollectionsReturn }) {
  if (page.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-12rem)]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Style Collections</h2>
        <ActionButton
          onClick={page.startCreate}
          icon={<Plus className="size-4" />}
        >
          New Style
        </ActionButton>
      </div>

      {page.styles.length === 0 ? (
        <EmptyStateCard>
          <p className="text-sm text-muted-foreground">
            No style collections yet. Create one to get started.
          </p>
        </EmptyStateCard>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {page.styles.map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => page.startEdit(style)}
              className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 hover:border-accent-brand/50 transition-colors text-left cursor-pointer"
            >
              {style.thumbnailUrl ? (
                <img
                  src={style.thumbnailUrl}
                  alt=""
                  className="w-full aspect-square rounded-lg object-cover bg-muted"
                />
              ) : (
                <div className="w-full aspect-square rounded-lg bg-muted" />
              )}
              <span className="text-sm font-medium truncate w-full text-center">
                {style.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {style.image_count} image{style.image_count !== 1 ? 's' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateView({ page }: { page: UseStyleCollectionsReturn }) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={page.backToLibrary}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <ArrowLeft className="size-3" />
        Back
      </button>

      <div className="flex flex-col items-center">
        <div className="w-full max-w-md space-y-4">
          <h2 className="text-lg font-medium">New Style Collection</h2>
          <div className="space-y-2">
            <label
              htmlFor="style-name"
              className="text-sm font-medium text-muted-foreground"
            >
              Name
            </label>
            <input
              id="style-name"
              type="text"
              value={page.newStyleName}
              onChange={(e) => page.setNewStyleName(e.target.value)}
              placeholder="e.g. Watercolor, Cyberpunk, Oil Paint..."
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && page.newStyleName.trim()) {
                  page.saveNewStyle()
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex justify-end">
            <ActionButton
              onClick={page.saveNewStyle}
              disabled={!page.newStyleName.trim()}
              loading={page.saving}
              loadingText="Creating..."
            >
              Create
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditView({ page }: { page: UseStyleCollectionsReturn }) {
  const style = page.editingStyle
  if (!style) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={page.backToLibrary}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-3" />
          Back
        </button>
        <button
          type="button"
          onClick={() => page.deleteCollection(style.id)}
          className="flex items-center gap-1 text-sm text-destructive hover:text-destructive/80 transition-colors cursor-pointer"
        >
          <Trash2 className="size-3" />
          Delete Style
        </button>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">{style.name}</h2>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {page.editingImages.length} image
            {page.editingImages.length !== 1 ? 's' : ''}
          </p>
          <ImageSourceButtons
            onFileSelected={(file) => page.addFileToStyle(file, style.id)}
            library={{
              images: page.existingImages.images,
              imageUrls: page.existingImages.imageUrls,
              isLoading: page.existingImages.isLoading,
              onSelect: (img) => page.addLibraryImageToStyle(img, style.id),
              onSelectMultiple: (imgs) =>
                page.addLibraryImagesToStyle(imgs, style.id),
              onOpen: page.existingImages.refresh,
            }}
            multiple
            className="flex items-center gap-2"
          />
        </div>

        {page.editingImagesLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : page.editingImages.length === 0 ? (
          <EmptyStateCard>
            <p className="text-sm text-muted-foreground">
              Add images from your library, upload files, or paste from
              clipboard.
            </p>
          </EmptyStateCard>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
            {page.editingImages.map((img) => (
              <div key={img.id} className="relative group">
                {img.url ? (
                  <img
                    src={img.url}
                    alt=""
                    className="aspect-square rounded-md object-cover bg-muted w-full"
                  />
                ) : (
                  <div className="aspect-square rounded-md bg-muted w-full" />
                )}
                <RemoveButton
                  onRemove={() => page.removeImage(style.id, img.id)}
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
