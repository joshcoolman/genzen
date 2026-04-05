import { createFileRoute, redirect } from '@tanstack/react-router'
import { CheckCircle2, Circle, Lock } from 'lucide-react'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { ALL_VIDEO_MODELS } from '@/features/ai-video/video-models'
import { ALL_TEXT_MODELS } from '@/lib/text-models'
import { useEnabledModels } from '@/lib/use-enabled-models'
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

function SettingsPage() {
  const {
    isModelEnabled,
    toggleModel,
    resetToDefaults,
    enabledImageCount,
    enabledVideoCount,
    enabledTextCount,
  } = useEnabledModels()
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
            Manage which models appear in selectors across the app.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Text to Image{' '}
            <span className="text-xs font-normal">
              ({enabledImageCount} of {ALL_IMAGE_MODELS.length} enabled)
            </span>
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[...ALL_IMAGE_MODELS]
              .sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0))
              .map((model) => {
                const enabled = isModelEnabled(model.id)
                const locked = model.locked === true
                return (
                  <button
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
                    disabled={locked}
                    className={cn(
                      'relative flex items-start gap-2 rounded-md px-3 py-2 text-left transition-colors',
                      locked ? 'cursor-default' : 'cursor-pointer',
                      enabled
                        ? 'bg-accent-brand/10 text-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {locked && (
                      <span className="absolute top-1 right-1.5 text-[9px] font-medium uppercase tracking-wider text-[#7dac8e]">
                        DEFAULT
                      </span>
                    )}
                    {locked ? (
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" />
                    ) : enabled ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm truncate">{model.name}</span>
                        {model.supportsImageInput && (
                          <span className="shrink-0 rounded bg-accent-brand/15 px-1 py-px text-[10px] text-accent-brand">
                            img
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] truncate text-[#7dac8e]">
                        {model.description}
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Video{' '}
            <span className="text-xs font-normal">
              ({enabledVideoCount} of {ALL_VIDEO_MODELS.length} enabled)
            </span>
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[...ALL_VIDEO_MODELS]
              .sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0))
              .map((model) => {
                const enabled = isModelEnabled(model.id)
                const locked = model.locked === true
                return (
                  <button
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
                    disabled={locked}
                    className={cn(
                      'relative flex items-start gap-2 rounded-md px-3 py-2 text-left transition-colors',
                      locked ? 'cursor-default' : 'cursor-pointer',
                      enabled
                        ? 'bg-accent-brand/10 text-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {locked && (
                      <span className="absolute top-1 right-1.5 text-[9px] font-medium uppercase tracking-wider text-[#7dac8e]">
                        DEFAULT
                      </span>
                    )}
                    {locked ? (
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" />
                    ) : enabled ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm truncate">{model.name}</span>
                        {model.supportsFlf && (
                          <span className="shrink-0 rounded bg-accent-brand/15 px-1 py-px text-[10px] text-accent-brand">
                            FLF
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] truncate text-[#7dac8e]">
                        {model.description}
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Text{' '}
            <span className="text-xs font-normal">
              ({enabledTextCount} of {ALL_TEXT_MODELS.length} enabled)
            </span>
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {[...ALL_TEXT_MODELS]
              .sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0))
              .map((model) => {
                const enabled = isModelEnabled(model.id)
                const locked = model.locked === true
                return (
                  <button
                    key={model.id}
                    onClick={() => toggleModel(model.id)}
                    disabled={locked}
                    className={cn(
                      'relative flex items-start gap-2 rounded-md px-3 py-2 text-left transition-colors',
                      locked ? 'cursor-default' : 'cursor-pointer',
                      enabled
                        ? 'bg-accent-brand/10 text-foreground'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {locked && (
                      <span className="absolute top-1 right-1.5 text-[9px] font-medium uppercase tracking-wider text-[#7dac8e]">
                        DEFAULT
                      </span>
                    )}
                    {locked ? (
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" />
                    ) : enabled ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" />
                    ) : (
                      <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm truncate">{model.name}</span>
                        {model.supportsVision && (
                          <span className="shrink-0 rounded bg-accent-brand/15 px-1 py-px text-[10px] text-accent-brand">
                            vision
                          </span>
                        )}
                        {model.isNew && (
                          <span className="shrink-0 rounded bg-warm-gold/15 px-1 py-px text-[10px] text-warm-gold">
                            new
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] truncate text-[#7dac8e]">
                        {model.description}
                      </div>
                    </div>
                  </button>
                )
              })}
          </div>
        </div>

        <button
          onClick={resetToDefaults}
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
