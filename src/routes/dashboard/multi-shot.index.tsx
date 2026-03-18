import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/lib/auth'
import { SequenceGrid, useMultishotSequences } from '@/features/multi-shot'
import { ActionButton } from '@/components/ActionButton'
import { saveSequence } from '@/features/multi-shot/server/save-sequence.server'
import { DEFAULT_SETTINGS } from '@/features/multi-shot/types'

export const Route = createFileRoute('/dashboard/multi-shot/')({
  component: MultiShotListPage,
})

function MultiShotListPage() {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const navigate = useNavigate()
  const sequences = useMultishotSequences({ accessToken })
  const [creating, setCreating] = useState(false)

  const handleNewSequence = async () => {
    if (!accessToken) return
    setCreating(true)
    try {
      const { id } = await saveSequence({
        data: {
          accessToken,
          name: 'Untitled',
          shots: [{ id: crypto.randomUUID(), prompt: '', duration: 5 }],
          elements: [],
          settings: DEFAULT_SETTINGS,
        },
      })
      navigate({
        to: '/dashboard/multi-shot/$sequenceId',
        params: { sequenceId: id },
      })
    } catch {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Sequences</h2>
        <ActionButton
          onClick={handleNewSequence}
          loading={creating}
          loadingText="Creating..."
          icon={<Plus className="h-4 w-4" />}
        >
          New Sequence
        </ActionButton>
      </div>

      <SequenceGrid
        sequences={sequences.sequences}
        loading={sequences.loading}
        onNavigate={(id) =>
          navigate({
            to: '/dashboard/multi-shot/$sequenceId',
            params: { sequenceId: id },
          })
        }
        onDuplicate={sequences.handleDuplicate}
        onDelete={sequences.handleDelete}
      />
    </div>
  )
}
