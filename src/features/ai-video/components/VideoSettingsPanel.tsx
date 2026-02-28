import type { VideoSettings } from '../types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface VideoSettingsPanelProps {
  settings: VideoSettings
  onChange: (settings: VideoSettings) => void
  onGenerate: () => void
  disabled: boolean
  generating: boolean
}

export function VideoSettingsPanel({
  settings,
  onChange,
  onGenerate,
  disabled,
  generating,
}: VideoSettingsPanelProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Video Settings</h2>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">
          Transition Prompt
        </label>
        <Textarea
          placeholder="Describe how the scene transitions between frames..."
          value={settings.prompt}
          onChange={(e) => onChange({ ...settings, prompt: e.target.value })}
          disabled={generating}
          rows={3}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Duration</label>
        <div className="flex gap-1">
          {(['5', '10'] as const).map((d) => (
            <button
              key={d}
              onClick={() => onChange({ ...settings, duration: d })}
              disabled={generating}
              className={cn(
                'px-3 py-1.5 text-xs rounded border transition-colors',
                settings.duration === d
                  ? 'border-accent-gold bg-accent-gold/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">
          CFG Scale ({settings.cfgScale.toFixed(2)})
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.cfgScale}
          onChange={(e) =>
            onChange({ ...settings, cfgScale: parseFloat(e.target.value) })
          }
          disabled={generating}
          className="w-full accent-accent-gold"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Negative Prompt</label>
        <Textarea
          placeholder="Things to avoid in the video..."
          value={settings.negativePrompt}
          onChange={(e) =>
            onChange({ ...settings, negativePrompt: e.target.value })
          }
          disabled={generating}
          rows={2}
        />
      </div>

      <Button
        onClick={onGenerate}
        disabled={disabled || generating}
        className="w-full"
      >
        {generating ? 'Generating Video...' : 'Generate Video'}
      </Button>
    </div>
  )
}
