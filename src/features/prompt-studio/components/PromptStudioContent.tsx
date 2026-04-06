import { useCallback, useState } from 'react'
import {
  BookmarkPlus,
  Check,
  ClipboardCopy,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  X,
} from 'lucide-react'
import {
  fetchImageBase64,
  runSingleModel,
} from '../server/run-prompt-studio.server'
import { ModelResultCard } from './ModelResultCard'
import { PromptSetsSidebar } from './PromptSetsSidebar'
import type { UsePromptStudioReturn } from '../hooks/usePromptStudio'
import type { ModelResult } from '../types'
import { ModelMultiSelect } from '@/components/ModelMultiSelect'
import { ActionButton } from '@/components/ActionButton'
import { useUserImages } from '@/features/user-images/hooks/useUserImages'
import { ImageSourceButtons } from '@/components/ImageSourceButtons'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { ALL_TEXT_MODELS } from '@/lib/text-models'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

const DESCRIBE_SYSTEM_PROMPT = `You are an image-to-prompt converter for an image generation pipeline. Your output will be fed directly to a text-to-image model as the prompt. Output ONLY the prompt text -- no headers, labels, hashtags, markdown, or commentary.

Write a concise visual description suitable for image generation. Include:
- Subject and composition
- For people: specific physical appearance -- ethnicity, gender, approximate age, build, hair color/style, and distinguishing features. These details are critical for generation fidelity.
- Style, medium, and artistic qualities
- Lighting, color palette, and mood
- Key visual details

Keep it under 400 characters. Plain text only. No line breaks.`

interface PromptStudioContentProps {
  studio: UsePromptStudioReturn
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function formatResults(
  prompt: string,
  systemPrompt: string,
  negativePrompt: string,
  hasImage: boolean,
  results: Array<ModelResult>,
): string {
  const lines: Array<string> = []
  lines.push('## Prompt Studio Run')
  lines.push('')
  lines.push(`**Prompt:** ${prompt}`)
  if (systemPrompt) lines.push(`**System:** ${systemPrompt}`)
  if (negativePrompt) lines.push(`**Avoid:** ${negativePrompt}`)
  if (hasImage) lines.push('**Image:** attached')
  lines.push('')

  const sorted = [...results].sort((a, b) => a.durationMs - b.durationMs)

  for (const r of sorted) {
    const model = ALL_TEXT_MODELS.find((m) => m.id === r.modelId)
    const name = model?.name ?? r.modelId
    const provider = model?.provider ?? ''
    const time = r.durationMs > 0 ? `${(r.durationMs / 1000).toFixed(1)}s` : ''

    lines.push(
      `### ${name}${provider ? ` (${provider})` : ''}${time ? ` -- ${time}` : ''}`,
    )
    if (r.error) {
      lines.push(`ERROR: ${r.error}`)
    } else if (r.text) {
      lines.push(r.text)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function PendingModelCard({ modelId }: { modelId: string }) {
  const model = ALL_TEXT_MODELS.find((m) => m.id === modelId)
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">{model?.name ?? modelId}</h3>
          <p className="text-xs text-muted-foreground">{model?.provider}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 py-4 text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        <span className="text-xs">Generating...</span>
      </div>
    </div>
  )
}

export function PromptStudioContent({ studio }: PromptStudioContentProps) {
  const { session } = useAuth()
  const userImages = useUserImages(session?.user.id)
  const [copiedResults, setCopiedResults] = useState(false)
  const [systemPromptExpanded, setSystemPromptExpanded] = useState(false)

  const [describing, setDescribing] = useState(false)

  const handleDescribe = useCallback(
    async (modelId: string) => {
      if (!studio.imageBase64 || !session) return
      setDescribing(true)
      try {
        const result = await runSingleModel({
          data: {
            prompt: 'Write an image generation prompt for this image.',
            systemPrompt: DESCRIBE_SYSTEM_PROMPT,
            modelId,
            accessToken: session.access_token,
            imageBase64: studio.imageBase64,
          },
        })
        if (result.text) {
          studio.setPrompt(result.text)
        }
      } catch {
        // silent
      } finally {
        setDescribing(false)
      }
    },
    [studio, session],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      studio.run()
    }
  }

  const handleFileSelected = useCallback(
    async (file: File) => {
      const base64 = await fileToBase64(file)
      const url = URL.createObjectURL(file)
      studio.setImage(url, base64)
    },
    [studio],
  )

  const handleLibrarySelect = useCallback(
    async (image: { url: string }) => {
      if (!session) return
      const base64 = await fetchImageBase64({
        data: { url: image.url, accessToken: session.access_token },
      })
      studio.setImage(image.url, base64)
    },
    [studio, session],
  )

  const hasImage = !!studio.imageUrl
  const visionModels = studio.enabledTextModels.filter((m) => m.supportsVision)
  const displayModels = hasImage ? visionModels : studio.enabledTextModels

  return (
    <div className="flex gap-0">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 space-y-5">
          {/* Controls -- two rows above the text inputs */}
          <div className="space-y-2">
            {/* Top row: active set (left) + secondary controls (right) */}
            <div className="flex items-center justify-between">
              {studio.activeSetId ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs',
                    studio.isDirty
                      ? 'text-yellow-500 border border-yellow-500/30'
                      : 'text-accent-brand border border-accent-brand/30',
                  )}
                >
                  {studio.promptSets.getSet(studio.activeSetId)?.name}
                  {studio.isDirty && ' (modified)'}
                </span>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-1">
                {(studio.isSystemPromptModified ||
                  studio.isNegativePromptModified) && (
                  <button
                    onClick={studio.restoreDefaults}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="size-3" />
                    Restore Defaults
                  </button>
                )}
                <button
                  onClick={() => studio.setSidebarOpen(!studio.sidebarOpen)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                    studio.sidebarOpen
                      ? 'text-accent-brand'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <BookmarkPlus className="size-4" />
                  Sets
                </button>
              </div>
            </div>

            {/* Bottom row: models (left) + run (right) */}
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">
                  Models
                  {hasImage && (
                    <span className="ml-1 text-muted-foreground/60">
                      (vision only)
                    </span>
                  )}
                </label>
                <ModelMultiSelect
                  models={displayModels}
                  selectedIds={studio.selectedModelIds}
                  onToggle={studio.toggleModel}
                />
              </div>
              <ActionButton
                onClick={studio.run}
                loading={studio.running}
                loadingText="Running..."
                icon={<Send className="size-4" />}
                disabled={
                  !studio.prompt.trim() || studio.selectedModelIds.length === 0
                }
              >
                Run
              </ActionButton>
            </div>
          </div>

          {/* Image + three-column text areas */}
          <div className="flex gap-4 items-start">
            {/* Image column */}
            <div className="w-[160px] shrink-0 space-y-1.5">
              <label className="text-xs text-muted-foreground">Image</label>
              <div className="flex items-center gap-1">
                <ImageSourceButtons
                  onFileSelected={handleFileSelected}
                  library={{
                    images: userImages.images,
                    imageUrls: userImages.imageUrls,
                    isLoading: userImages.isLoading,
                    onSelect: handleLibrarySelect,
                  }}
                  showPaste={true}
                />
                {hasImage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={describing}
                        title="Describe image into prompt"
                        className="shrink-0 size-8"
                      >
                        <MessageSquare
                          className={cn(
                            'size-3.5',
                            describing && 'animate-pulse',
                          )}
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {visionModels.map((model) => (
                        <DropdownMenuItem
                          key={model.id}
                          onClick={() => void handleDescribe(model.id)}
                        >
                          <span className="text-xs">{model.name}</span>
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {model.provider}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {hasImage ? (
                <div className="relative group">
                  <img
                    src={studio.imageUrl!}
                    alt="Reference"
                    className="w-full rounded-md border border-input object-cover aspect-square"
                  />
                  <button
                    onClick={studio.clearImage}
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="size-3 text-white" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-input aspect-square text-muted-foreground">
                  <ImageIcon className="size-6 mb-2 opacity-40" />
                  <span className="text-[10px]">Optional</span>
                </div>
              )}
            </div>

            {/* Prompt columns */}
            <div className="flex-1 grid grid-cols-3 gap-4 items-start">
              <div className="space-y-1.5">
                <label
                  className="text-xs text-muted-foreground"
                  htmlFor="prompt-input"
                >
                  Prompt
                </label>
                <textarea
                  id="prompt-input"
                  value={studio.prompt}
                  onChange={(e) => studio.setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="An elf walks into a bar..."
                  className="w-full min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none [field-sizing:content]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    className="text-xs text-muted-foreground"
                    htmlFor="system-prompt"
                  >
                    System Prompt
                  </label>
                  {studio.customSystemPrompt && (
                    <button
                      type="button"
                      onClick={() => setSystemPromptExpanded((v) => !v)}
                      className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {systemPromptExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  )}
                </div>
                {systemPromptExpanded ? (
                  <textarea
                    id="system-prompt"
                    value={studio.customSystemPrompt}
                    onChange={(e) =>
                      studio.setCustomSystemPrompt(e.target.value)
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Instructions for the model..."
                    className="w-full min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none [field-sizing:content]"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setSystemPromptExpanded(true)}
                    className="w-full text-left"
                  >
                    <div className="relative rounded-md border border-input bg-transparent px-3 py-2 overflow-hidden max-h-[5.5rem]">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {studio.customSystemPrompt || (
                          <span className="italic">
                            Instructions for the model...
                          </span>
                        )}
                      </p>
                      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent" />
                    </div>
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  className="text-xs text-muted-foreground"
                  htmlFor="negative-prompt"
                >
                  Avoid
                </label>
                <textarea
                  id="negative-prompt"
                  value={studio.negativePrompt}
                  onChange={(e) => studio.setNegativePrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Words to avoid..."
                  className="w-full min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none [field-sizing:content]"
                />
              </div>
            </div>
          </div>
        </div>

        {(studio.results.length > 0 || studio.pendingModelIds.size > 0) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              {studio.running && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span className="text-xs">
                    {studio.results.length} of{' '}
                    {studio.results.length + studio.pendingModelIds.size}{' '}
                    complete
                  </span>
                </div>
              )}
              {!studio.running && <div />}
              {studio.results.length > 0 && (
                <button
                  onClick={async () => {
                    const md = formatResults(
                      studio.prompt,
                      studio.customSystemPrompt,
                      studio.negativePrompt,
                      !!studio.imageUrl,
                      studio.results,
                    )
                    await navigator.clipboard.writeText(md)
                    setCopiedResults(true)
                    setTimeout(() => setCopiedResults(false), 2000)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors',
                    copiedResults
                      ? 'text-green-500'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {copiedResults ? (
                    <Check className="size-3" />
                  ) : (
                    <ClipboardCopy className="size-3" />
                  )}
                  {copiedResults ? 'Copied' : 'Copy Results'}
                </button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {studio.results.map((result) => (
                <ModelResultCard key={result.modelId} result={result} />
              ))}
              {Array.from(studio.pendingModelIds).map((modelId) => (
                <PendingModelCard key={modelId} modelId={modelId} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      {studio.sidebarOpen && <PromptSetsSidebar studio={studio} />}
    </div>
  )
}
