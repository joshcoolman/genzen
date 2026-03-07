import { ALL_VIDEO_MODELS, getVideoModel } from '../video-models'
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
  firstFrameReady: boolean
}

export function VideoSettingsPanel({
  settings,
  onChange,
  onGenerate,
  disabled,
  generating,
  firstFrameReady,
}: VideoSettingsPanelProps) {
  const selectedModel = getVideoModel(settings.videoModel)
  const durations = selectedModel?.durations ?? ['5', '10']

  function handleModelChange(modelId: string) {
    const model = getVideoModel(modelId)
    const modelDurations = model?.durations ?? ['5', '10']
    const newSettings: VideoSettings = { ...settings, videoModel: modelId }
    if (!modelDurations.includes(settings.duration)) {
      newSettings.duration = modelDurations[0]
    }
    onChange(newSettings)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Video Settings</h2>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Model</label>
        <div className="flex flex-wrap gap-1">
          {ALL_VIDEO_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => handleModelChange(m.id)}
              disabled={generating}
              title={m.description}
              className={cn(
                'px-3 py-1.5 text-xs rounded border transition-colors',
                settings.videoModel === m.id
                  ? 'border-accent-brand bg-accent-brand/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {m.name}
            </button>
          ))}
        </div>
        {selectedModel && !selectedModel.supportsFlf && (
          <p className="text-xs text-muted-foreground">
            This model supports first frame only
          </p>
        )}
      </div>

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
          {durations.map((d) => (
            <button
              key={d}
              onClick={() => onChange({ ...settings, duration: d })}
              disabled={generating}
              className={cn(
                'px-3 py-1.5 text-xs rounded border transition-colors',
                settings.duration === d
                  ? 'border-accent-brand bg-accent-brand/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {d}s
            </button>
          ))}
        </div>
      </div>

      {selectedModel?.supportsCfgScale !== false && (
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
            className="w-full accent-accent-brand"
          />
        </div>
      )}

      {selectedModel?.supportsNegativePrompt !== false && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">
            Negative Prompt
          </label>
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
      )}

      {!firstFrameReady && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Generate a first frame to enable video
        </p>
      )}

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
