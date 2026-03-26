import { useEffect } from 'react'
import { ScenesGrid } from './ScenesGrid'
import { ScenesPanel } from './ScenesPanel'
import type { ScenesState } from '../types'
import { TwoColumnLayout } from '@/components/TwoColumnLayout'
import { Lightbox } from '@/components/Lightbox'
import { useCredits } from '@/features/credits/hooks/use-credits'

interface ScenesPageProps {
  state: ScenesState
}

export function ScenesPage({ state }: ScenesPageProps) {
  const credits = useCredits()

  // Capture paste events — load pasted image as source
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            e.preventDefault()
            state.setSourceFile(file)
            return
          }
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [state.setSourceFile])

  const left = (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-medium">Scenes</h2>
        {credits.balance !== null && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {credits.balance} credits
          </p>
        )}
      </div>
      <ScenesPanel state={state} />
    </div>
  )

  const right = <ScenesGrid state={state} />

  return (
    <>
      <TwoColumnLayout left={left} right={right} topOffset="5rem" />

      {state.lightboxOpen && state.lightboxImages.length > 0 && (
        <Lightbox
          images={state.lightboxImages}
          imageUrls={state.imageUrls}
          currentIndex={state.lightboxIndex}
          onClose={state.closeLightbox}
          onNext={state.lightboxNext}
          onPrev={state.lightboxPrev}
        />
      )}
    </>
  )
}
