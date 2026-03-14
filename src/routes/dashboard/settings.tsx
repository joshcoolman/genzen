import { createFileRoute, redirect } from '@tanstack/react-router'
import type { SlotTier } from '@/lib/model-slots'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { ALL_VIDEO_MODELS } from '@/features/ai-video/video-models'
import { SLOT_DEFAULTS, useModelSlots } from '@/lib/model-slots'

export const Route = createFileRoute('/dashboard/settings')({
  beforeLoad: ({ context }) => {
    if ((context as { accountStatus: string }).accountStatus !== 'active') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: SettingsPage,
})

const SLOT_CONFIG: Array<{
  tier: SlotTier
  label: string
  description: string
  models: Array<{ id: string; name: string }>
}> = [
  {
    tier: 'draft',
    label: 'Draft',
    description: 'Fast iteration, brainstorming, quick previews',
    models: ALL_IMAGE_MODELS.map((m) => ({ id: m.id, name: m.name })),
  },
  {
    tier: 'quality',
    label: 'Quality',
    description: 'Final renders, hero images, polished output',
    models: ALL_IMAGE_MODELS.map((m) => ({ id: m.id, name: m.name })),
  },
  {
    tier: 'video',
    label: 'Video',
    description: 'Video generation model',
    models: ALL_VIDEO_MODELS.map((m) => ({ id: m.id, name: m.name })),
  },
]

function SettingsPage() {
  const { slots, setSlot } = useModelSlots()

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <div className="bg-card rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-lg font-medium">Models</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose which model fills each slot. Draft for speed, Quality for
            polish.
          </p>
        </div>

        <div className="space-y-4">
          {SLOT_CONFIG.map(({ tier, label, description, models }) => (
            <div
              key={tier}
              className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">
                  {description}
                </div>
              </div>
              <select
                value={slots[tier]}
                onChange={(e) => setSlot(tier, e.target.value)}
                className="rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-foreground min-w-[200px]"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.id === SLOT_DEFAULTS[tier] ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            setSlot('draft', SLOT_DEFAULTS.draft)
            setSlot('quality', SLOT_DEFAULTS.quality)
            setSlot('video', SLOT_DEFAULTS.video)
          }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
