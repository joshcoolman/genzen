import { Sparkles } from 'lucide-react'
import { FrameImageArea } from './FrameImageArea'
import type { FrameMode, FrameStatus, LastFrameMode } from '../types'
import { ActionButton } from '@/components/ActionButton'
import { Textarea } from '@/components/ui/textarea'
import { MiniTabs } from '@/components/MiniTabs'
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
  suggesting?: boolean
  onSuggest?: () => void
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
  suggesting,
  onSuggest,
  onChooseImage,
  onGenerate,
}: FirstFramePanelProps) {
  const isPromptMode = mode === 'prompt'
  const showPromptArea = isPromptMode && status === 'idle'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">First Frame</h2>
        <MiniTabs
          options={['prompt', 'image'] as Array<FrameMode>}
          value={mode}
          onChange={onModeChange}
          disabled={status === 'generating'}
        />
      </div>

      {showPromptArea ? (
        <div className="relative aspect-video rounded-lg border border-dashed border-border bg-muted/30 overflow-hidden">
          <Textarea
            placeholder="Describe the opening scene..."
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            className="h-full w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={6}
          />
          {onSuggest && (
            <button
              onClick={onSuggest}
              disabled={suggesting}
              className="absolute bottom-2 right-2 size-7 flex items-center justify-center text-muted-foreground hover:text-foreground bg-background/80 backdrop-blur-sm rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Suggest a prompt"
            >
              <Sparkles
                className={cn('size-3.5', suggesting && 'animate-pulse')}
              />
            </button>
          )}
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
        <ActionButton
          onClick={onGenerate}
          disabled={status === 'generating' || !prompt.trim()}
          className="w-full"
        >
          {status === 'generating'
            ? 'Generating...'
            : status === 'completed'
              ? 'Regenerate First Frame'
              : 'Generate First Frame'}
        </ActionButton>
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
  const isPromptMode = mode === 'prompt'
  const showPromptArea = isPromptMode && !locked && status === 'idle'

  return (
    <div
      className={cn(
        'space-y-3 transition-opacity',
        locked && 'opacity-40 pointer-events-none',
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Last Frame</h2>
        <MiniTabs
          options={['prompt', 'image'] as Array<LastFrameMode>}
          value={mode}
          onChange={onModeChange}
          disabled={status === 'generating'}
        />
      </div>

      {showPromptArea ? (
        <div className="relative aspect-video rounded-lg border border-dashed border-border bg-muted/30 overflow-hidden">
          <Textarea
            placeholder="Describe what changes in the scene..."
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            className="h-full w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            rows={6}
          />
          <button
            onClick={onSuggest}
            disabled={suggesting}
            className="absolute bottom-2 right-2 size-7 flex items-center justify-center text-muted-foreground hover:text-foreground bg-background/80 backdrop-blur-sm rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Suggest a prompt"
          >
            <Sparkles
              className={cn('size-3.5', suggesting && 'animate-pulse')}
            />
          </button>
        </div>
      ) : (
        <FrameImageArea
          status={status}
          imageUrl={url}
          placeholder={
            locked
              ? 'Generate first frame first'
              : 'Last frame will appear here'
          }
          generatingLabel="Generating..."
          onChooseImage={
            mode === 'image' && status !== 'generating' && !locked
              ? onChooseImage
              : undefined
          }
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <ActionButton
        onClick={onGenerate}
        disabled={generateDisabled}
        className="w-full"
      >
        {status === 'generating'
          ? 'Generating...'
          : mode === 'image' && url
            ? 'Generate Video'
            : status === 'completed'
              ? 'Regenerate Last Frame'
              : 'Generate Last Frame'}
      </ActionButton>

      {isPromptMode && !locked && (
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
    </div>
  )
}
