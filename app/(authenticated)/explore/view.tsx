'use client'

import { Lightbox } from '../images/_components/lightbox/lightbox'
import { Masonry } from './_components/masonry/masonry'
import { useView } from './use-view'
import type { SavedAiImage } from '#/features/ai-images/types'
import { EmptyState } from '#/components'

export function View({ initial }: { initial: Array<SavedAiImage> }) {
  const { images, thumbnailUrls, lightbox } = useView(initial)

  if (images.length === 0) {
    return (
      <EmptyState title="Nothing to explore yet">
        Images you generate or upload show up here to browse.
      </EmptyState>
    )
  }

  return (
    <>
      <Masonry
        images={images}
        thumbnailUrls={thumbnailUrls}
        onOpen={lightbox.open}
      />

      {/* The overlay covers everything, and here that costs nothing: browsing
          has no work to lose sight of, and closing puts you back at the same
          scroll position in the same grid. That is the context it was designed
          for, and the reason it never sat right on the working surface. */}
      {lightbox.isOpen && (
        <Lightbox
          images={lightbox.items}
          imageUrls={lightbox.imageUrls}
          thumbnailUrls={lightbox.thumbnailUrls}
          currentIndex={lightbox.index!}
          onClose={lightbox.close}
          onSelect={lightbox.select}
          onNext={lightbox.next}
          onPrev={lightbox.prev}
        />
      )}
    </>
  )
}
