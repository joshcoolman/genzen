import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth'
import { useCredits } from '@/features/credits/hooks/use-credits'
import { BrainstormPanel } from '@/features/ai-images'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'

export const Route = createFileRoute('/dashboard/dev-workspace/brainstorm')({
  component: BrainstormPage,
})

function BrainstormPage() {
  const { session } = useAuth()
  const credits = useCredits()
  const accessToken = session?.access_token

  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Brainstorm</h1>
        <div className="flex items-center gap-4">
          <AspectRatioSelect
            orientation={orientation}
            aspectRatio={aspectRatio}
            onOrientationChange={setOrientation}
            onAspectRatioChange={setAspectRatio}
          />
          {credits.balance !== null && (
            <span className="text-sm text-muted-foreground tabular-nums">
              {credits.balance} credits
            </span>
          )}
        </div>
      </div>

      <BrainstormPanel accessToken={accessToken} aspectRatio={aspectRatio} />
    </div>
  )
}
