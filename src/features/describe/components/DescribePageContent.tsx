import { CollectionToolbar } from './CollectionToolbar'
import { ImageCollectionGrid } from './ImageCollectionGrid'
import { ExistingImagePicker } from './ExistingImagePicker'
import { ImageDescriberCard } from './ImageDescriberCard'
import { SingleImagePicker } from './SingleImagePicker'
import type { UseDescribePageReturn } from '../hooks/useDescribePage'

interface DescribePageContentProps {
  page: UseDescribePageReturn
}

export function DescribePageContent({ page }: DescribePageContentProps) {
  return (
    <div className="space-y-6">
      <CollectionToolbar
        onFilesSelected={page.handleFilesSelected}
        onImagePasted={page.handleImagePasted}
        onOpenPicker={page.openPicker}
        isUploading={page.isUploading}
        collectionCount={page.collection.count}
      />

      <ImageCollectionGrid
        images={page.collection.images}
        onRemove={page.handleRemove}
      />

      <ExistingImagePicker
        open={page.isPickerOpen}
        onOpenChange={page.setPickerOpen}
        images={page.existingImages.images}
        imageUrls={page.existingImages.imageUrls}
        isLoading={page.existingImages.isLoading}
        alreadyCollectedIds={page.collection.imageIds}
        onConfirm={page.collection.addMany}
      />

      <ImageDescriberCard describer={page.describer} />

      <SingleImagePicker
        open={page.describer.isPickerOpen}
        onOpenChange={(open) => {
          if (!open) page.describer.closePicker()
        }}
        images={page.existingImages.images}
        imageUrls={page.existingImages.imageUrls}
        isLoading={page.existingImages.isLoading}
        onSelect={page.describer.selectImage}
      />
    </div>
  )
}
