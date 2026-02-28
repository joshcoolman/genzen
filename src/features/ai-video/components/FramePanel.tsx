import { FrameImageArea } from './FrameImageArea'
import type { FrameMode, FrameStatus, LastFrameMode } from '../types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface FirstFramePanelProps {
  type: 'first'
  mode: FrameMode
  onModeChange: (mode: FrameMode) => void
  status: FrameStatus
  url: string | null
  error: string | null
  prompt: string
  onPromptChange: (value: string) => void
  onChooseImage?: () => void
  onGenerate: () => void
}

interface LastFramePanelProps {
  type: 'last'
  mode: LastFrameMode
  onModeChange: (mode: LastFrameMode) => void
  status: FrameStatus
  url: string | null
  error: string | null
  locked: boolean
  prompt: string
  onPromptChange: (value: string) => void
  suggesting: boolean
  onSuggest: () => void
  onChooseImage?: () => void
  onGenerate: () => void
  generateDisabled: boolean
  includeFirstFrame: boolean
  onIncludeFirstFrameChange: (value: boolean) => void
}

type FramePanelProps = FirstFramePanelProps | LastFramePanelProps

export function FramePanel(props: FramePanelProps) {
  if (props.type === 'first') {
    return <FirstFramePanel {...props} />
  }
  return <LastFramePanel {...props} />
}

function FirstFramePanel({
  mode,
  onModeChange,
  status,
  url,
  error,
  prompt,
  onPromptChange,
  onChooseImage,
  onGenerate,
}: FirstFramePanelProps) {
  const isPromptMode = mode === 'prompt'
  const showPromptArea = isPromptMode && status === 'idle'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">First Frame</h2>
        <div className="flex gap-1">
          {(['prompt', 'image'] as Array<FrameMode>).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              disabled={status === 'generating'}
              className={cn(
                'px-2 py-1 text-xs rounded border transition-colors capitalize',
                mode === m
                  ? 'border-accent-gold bg-accent-gold/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {showPromptArea ? (
        <div className="aspect-video rounded-lg border border-dashed border-border bg-muted/30 overflow-hidden">
          <Textarea
            placeholder="Describe the opening scene..."
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            className="h-full w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={6}
          />
        </div>
      ) : (
        <FrameImageArea
          status={status}
          imageUrl={url}
          placeholder="First frame will appear here"
          generatingLabel={isPromptMode ? 'Generating...' : 'Uploading...'}
          onChooseImage={
            !isPromptMode && status !== 'generating' ? onChooseImage : undefined
          }
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {isPromptMode && (
        <Button
          onClick={onGenerate}
          disabled={status === 'generating' || !prompt.trim()}
          className="w-full"
        >
          {status === 'generating'
            ? 'Generating...'
            : status === 'completed'
              ? 'Regenerate First Frame'
              : 'Generate First Frame'}
        </Button>
      )}
    </div>
  )
}

function LastFramePanel({
  mode,
  onModeChange,
  status,
  url,
  error,
  locked,
  prompt,
  onPromptChange,
  suggesting,
  onSuggest,
  onChooseImage,
  onGenerate,
  generateDisabled,
  includeFirstFrame,
  onIncludeFirstFrameChange,
}: LastFramePanelProps) {
  return (
    <div
      className={cn(
        'space-y-3 transition-opacity',
        locked && 'opacity-40 pointer-events-none',
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Last Frame</h2>
        <div className="flex gap-1">
          {(['prompt', 'image'] as Array<LastFrameMode>).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              disabled={status === 'generating'}
              className={cn(
                'px-2 py-1 text-xs rounded border transition-colors capitalize',
                mode === m
                  ? 'border-accent-gold bg-accent-gold/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <FrameImageArea
        status={status}
        imageUrl={url}
        placeholder={
          locked ? 'Generate first frame first' : 'Last frame will appear here'
        }
        generatingLabel="Generating..."
        onChooseImage={
          mode === 'image' && status !== 'generating' && !locked
            ? onChooseImage
            : undefined
        }
      />

      {mode === 'prompt' && !locked && (
        <div className="relative">
          <Textarea
            placeholder="Describe what changes in the scene..."
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            disabled={status === 'generating'}
            rows={4}
          />
          <button
            onClick={onSuggest}
            disabled={suggesting || status === 'generating'}
            className="absolute bottom-2 right-2 text-[10px] text-muted-foreground hover:text-foreground bg-background/80 backdrop-blur-sm px-1.5 py-0.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {suggesting ? 'Suggesting...' : 'Suggest'}
          </button>
        </div>
      )}

      {mode === 'prompt' && !locked && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeFirstFrame}
            onChange={(e) => onIncludeFirstFrameChange(e.target.checked)}
            disabled={status === 'generating'}
            className="accent-accent-gold"
          />
          <span className="text-xs text-muted-foreground">
            Use first frame as reference
          </span>
        </label>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Button
        onClick={onGenerate}
        disabled={generateDisabled}
        className="w-full"
      >
        {status === 'generating'
          ? 'Generating...'
          : mode === 'image' && url
            ? 'Generate Video'
            : 'Generate Last Frame'}
      </Button>
    </div>
  )
}
