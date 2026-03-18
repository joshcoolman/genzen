import { useCallback } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { CreateUserImageInput } from '@/features/user-images/types'
import { useAuth } from '@/lib/auth'
import { useUserImages } from '@/features/user-images/hooks/useUserImages'
import { MultiShotEditor } from '@/features/multi-shot'
import { useSequenceDetail } from '@/features/multi-shot/hooks/use-sequence-detail'
import { GenerationHistory } from '@/features/multi-shot/components/GenerationHistory'
import { TimeBudgetBar } from '@/features/multi-shot/components/TimeBudgetBar'

export const Route = createFileRoute('/dashboard/multi-shot/$sequenceId')({
  component: SequenceDetailPage,
})

function SequenceDetailPage() {
  const { sequenceId } = Route.useParams()
  const { session, user } = useAuth()
  const accessToken = session?.access_token
  const userImagesHook = useUserImages(user?.id)

  const handleUpload = useCallback(
    async (input: CreateUserImageInput) => {
      await userImagesHook.create(input)
    },
    [userImagesHook.create],
  )

  const {
    editor,
    generations,
    generationsLoading,
    sequenceLoading,
    elementsLocked,
    handleDeleteGeneration,
  } = useSequenceDetail({ accessToken, sequenceId })

  if (sequenceLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="w-80 shrink-0 flex items-center">
          <Link
            to="/dashboard/multi-shot"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to sequences
          </Link>
        </div>
        <div className="flex-1">
          <TimeBudgetBar
            shots={editor.shots}
            totalDuration={editor.totalDuration}
            estimatedCost={editor.estimatedCost}
          />
        </div>
      </div>

      <MultiShotEditor
        editor={editor}
        userImages={userImagesHook.images}
        imageUrls={userImagesHook.imageUrls}
        imagesLoading={userImagesHook.isLoading}
        elementsLocked={elementsLocked}
        onUpload={handleUpload}
        isUploading={userImagesHook.isCreating}
      >
        <GenerationHistory
          generations={generations}
          loading={generationsLoading}
          onDelete={handleDeleteGeneration}
        />
      </MultiShotEditor>
    </div>
  )
}
