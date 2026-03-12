import { Loader2, Sparkles, Wand2 } from 'lucide-react'
import type { UseStoryboardReturn } from '../hooks/useStoryboard'
import { ActionButton } from '@/components/ActionButton'

interface StoryPromptSectionProps {
  sb: UseStoryboardReturn
}

export function StoryPromptSection({ sb }: StoryPromptSectionProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Story</h2>
        <p className="text-sm text-muted-foreground">
          Describe what happens — we'll break it into scenes
        </p>
      </div>

      <textarea
        value={sb.storyPrompt}
        onChange={(e) => {
          sb.setStoryPrompt(e.target.value)
          e.target.style.height = 'auto'
          e.target.style.height = `${e.target.scrollHeight}px`
        }}
        ref={(el) => {
          if (el) {
            el.style.height = 'auto'
            el.style.height = `${el.scrollHeight}px`
          }
        }}
        placeholder="What's the story? Just tell us what happens..."
        rows={4}
        className="w-full resize-none overflow-hidden rounded-md border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
      />

      <div className="flex items-center gap-2">
        <ActionButton
          onClick={sb.refineStory}
          disabled={!sb.storyPrompt.trim()}
          loading={sb.isRefining}
          loadingText="Refining..."
          icon={<Wand2 className="size-4" />}
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
        >
          Refine Story
        </ActionButton>

        <ActionButton
          onClick={sb.generateScenes}
          disabled={!sb.storyPrompt.trim() || sb.isGeneratingScenes}
          loading={sb.isGeneratingScenes}
          loadingText="Generating..."
          icon={<Sparkles className="size-4" />}
        >
          Generate Scenes
        </ActionButton>

        {sb.isGeneratingScenes && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Breaking story into scenes...
          </span>
        )}
      </div>
    </div>
  )
}
