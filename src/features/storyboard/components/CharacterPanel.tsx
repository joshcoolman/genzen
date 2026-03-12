import { useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Sparkles, X } from 'lucide-react'
import type { UseStoryboardReturn } from '../hooks/useStoryboard'
import { ActionButton } from '@/components/ActionButton'

interface CharacterPanelProps {
  sb: UseStoryboardReturn
}

export function CharacterPanel({ sb }: CharacterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (sb.characters.length === 0) return null

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-lg font-semibold"
      >
        {isExpanded ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        Characters ({sb.characters.length})
      </button>

      {isExpanded && (
        <div className="grid gap-3 sm:grid-cols-2">
          {sb.characters.map((character) => (
            <CharacterCard
              key={character.slug}
              character={character}
              isGenerating={sb.generatingCharacterSlugs.has(character.slug)}
              onUpdateDescription={(desc) =>
                sb.updateCharacter(character.slug, { description: desc })
              }
              onGenerateRef={(prompt) =>
                sb.generateCharacterRef(character.slug, prompt)
              }
              onRemoveRefImage={(imageId) =>
                sb.updateCharacter(character.slug, {
                  reference_images: character.reference_images.filter(
                    (img) => img.id !== imageId,
                  ),
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CharacterCardProps {
  character: UseStoryboardReturn['characters'][number]
  isGenerating: boolean
  onUpdateDescription: (desc: string) => void
  onGenerateRef: (promptOverride?: string) => void
  onRemoveRefImage: (imageId: string) => void
}

function CharacterCard({
  character,
  isGenerating,
  onUpdateDescription,
  onGenerateRef,
  onRemoveRefImage,
}: CharacterCardProps) {
  const [isEditingDesc, setIsEditingDesc] = useState(false)
  const [editDesc, setEditDesc] = useState(character.description)
  const [showPromptInput, setShowPromptInput] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const hasRefs = character.reference_images.length > 0

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`size-2 rounded-full ${hasRefs ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
          />
          <h3 className="text-sm font-medium">{character.name}</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {character.reference_images.length}/14 refs
        </span>
      </div>

      {/* Description */}
      {isEditingDesc ? (
        <div className="space-y-1.5">
          <textarea
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                onUpdateDescription(editDesc)
                setIsEditingDesc(false)
              }}
              className="rounded px-2 py-0.5 text-xs bg-primary text-primary-foreground"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditDesc(character.description)
                setIsEditingDesc(false)
              }}
              className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p
          onClick={() => setIsEditingDesc(true)}
          className="text-xs leading-relaxed text-muted-foreground cursor-pointer hover:text-foreground/80 transition-colors"
        >
          {character.description}
        </p>
      )}

      {/* Reference image gallery */}
      {character.reference_images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {character.reference_images.map((img) => (
            <div key={img.id} className="group relative">
              {img.url ? (
                <img
                  src={img.url}
                  alt="Character reference"
                  className="size-14 rounded object-cover"
                />
              ) : (
                <div className="flex size-14 items-center justify-center rounded bg-muted">
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                </div>
              )}
              <button
                onClick={() => onRemoveRefImage(img.id)}
                className="absolute -right-1 -top-1 hidden rounded-full bg-destructive p-0.5 text-destructive-foreground group-hover:block"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        {showPromptInput ? (
          <div className="flex flex-1 gap-1.5">
            <input
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Custom prompt..."
              className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onGenerateRef(customPrompt || undefined)
                  setCustomPrompt('')
                  setShowPromptInput(false)
                }
              }}
            />
            <ActionButton
              onClick={() => {
                onGenerateRef(customPrompt || undefined)
                setCustomPrompt('')
                setShowPromptInput(false)
              }}
              loading={isGenerating}
              loadingText="..."
              className="h-7 px-2 text-xs"
              icon={<Sparkles className="size-3" />}
            >
              Go
            </ActionButton>
            <button
              onClick={() => setShowPromptInput(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <ActionButton
              onClick={() => onGenerateRef()}
              loading={isGenerating}
              loadingText="Generating..."
              className="h-7 px-2 text-xs"
              icon={<Sparkles className="size-3" />}
            >
              Generate Ref
            </ActionButton>
            <button
              onClick={() => setShowPromptInput(true)}
              className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Custom Prompt
            </button>
          </>
        )}
      </div>
    </div>
  )
}
