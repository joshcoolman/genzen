import { createFileRoute, redirect } from '@tanstack/react-router'
import { CheckCircle2, Circle } from 'lucide-react'
import type { SlotTier } from '@/lib/model-slots'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { ALL_VIDEO_MODELS } from '@/features/ai-video/video-models'
import { SLOT_DEFAULTS, useModelSlots } from '@/lib/model-slots'
import { navItems } from '@/lib/nav-items'
import { useNavVisibility } from '@/lib/use-nav-visibility'
import { cn } from '@/lib/utils'

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
  const { toggleItem, isItemHidden, showMoreNav, toggleShowMore } =
    useNavVisibility()

  const sidebarItems = navItems.filter((item) => item.id !== 'account')

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

      <div className="bg-card rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-lg font-medium">Sidebar</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose which items appear in the sidebar navigation.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {sidebarItems.map((item) => {
            const isAlwaysVisible = item.alwaysVisible === true
            const isHidden = isItemHidden(item.id)
            const isVisible = isAlwaysVisible || !isHidden
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (!isAlwaysVisible) toggleItem(item.id)
                }}
                disabled={isAlwaysVisible}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  isAlwaysVisible
                    ? 'cursor-default'
                    : 'cursor-pointer hover:bg-muted',
                  isVisible ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {isVisible ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-brand" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>

        <div className="border-t border-border pt-4">
          <button
            onClick={() => toggleShowMore()}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-muted transition-colors',
              showMoreNav ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {showMoreNav ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-brand" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
            )}
            <span>Show More menu</span>
          </button>
        </div>
      </div>
    </div>
  )
}
