import { useCallback } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { CREDIT_COSTS } from '@/features/credits'
import { useRequireCredits } from '@/features/credits/hooks/use-require-credits'
import { useAuth } from '@/lib/auth'
import { useUserImages } from '@/features/user-images/hooks/useUserImages'
import { MultiShotEditor } from '@/features/multi-shot'
import { useSequenceDetail } from '@/features/multi-shot/hooks/use-sequence-detail'
import { GenerationHistory } from '@/features/multi-shot/components/GenerationHistory'
import { TimeBudgetBar } from '@/features/multi-shot/components/TimeBudgetBar'
import { useRegisterADContext } from '@/features/ad/context/ad-context'
import multishotPersona from '@/features/multi-shot/persona.md?raw'

export const Route = createFileRoute('/dashboard/multi-shot/$sequenceId')({
  component: SequenceDetailPage,
})

function SequenceDetailPage() {
  const { sequenceId } = Route.useParams()
  const { session, user } = useAuth()
  const accessToken = session?.access_token
  useRequireCredits(CREDIT_COSTS.multishot_gen)
  useRegisterADContext('multi-shot', multishotPersona)
  const userImagesHook = useUserImages(user?.id)

  const handleUpload = useCallback(
    async (file: File, title: string) => {
      await userImagesHook.create({ file, title })
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
