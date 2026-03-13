import { useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  ImagePlus,
  Library,
  Loader2,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import type { UseStoryboardReturn } from '../hooks/useStoryboard'
import type { LightboxImage } from '@/components/Lightbox'
import { ActionButton } from '@/components/ActionButton'
import { Lightbox } from '@/components/Lightbox'
import { ExistingImagePicker } from '@/features/user-images/components/ExistingImagePicker'
import { useExistingImages } from '@/features/user-images/hooks/useExistingImages'
import { useImageUpload } from '@/features/user-images/hooks/useImageUpload'
import { useClipboardPaste } from '@/features/user-images/hooks/useClipboardPaste'
import { processAndUploadFiles } from '@/features/user-images/lib/process-files'
import { useAuth } from '@/lib/auth'

interface CharacterPanelProps {
  sb: UseStoryboardReturn
}

export function CharacterPanel({ sb }: CharacterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [focusedSlug, setFocusedSlug] = useState<string | null>(null)
  const { user } = useAuth()
  const userId = user?.id
  const existingImages = useExistingImages(userId)
  const { upload } = useImageUpload(userId)

  useClipboardPaste({
    enabled: !!focusedSlug,
    onUpload: async (input) => {
      const result = await upload(input)
      if (focusedSlug) {
        sb.addCharacterRefImage(focusedSlug, {
          id: result.id,
          url: result.url,
        })
      }
    },
  })

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
              onAddRefImage={(image) =>
                sb.addCharacterRefImage(character.slug, image)
              }
              onFocus={() => setFocusedSlug(character.slug)}
              existingImages={existingImages}
              userId={userId}
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
  onAddRefImage: (image: { id: string; url: string | null }) => void
  onFocus: () => void
  existingImages: ReturnType<typeof useExistingImages>
  userId: string | undefined
}

function CharacterCard({
  character,
  isGenerating,
  onUpdateDescription,
  onGenerateRef,
  onRemoveRefImage,
  onAddRefImage,
  onFocus,
  existingImages,
  userId,
}: CharacterCardProps) {
  const [isEditingDesc, setIsEditingDesc] = useState(false)
  const [editDesc, setEditDesc] = useState(character.description)
  const [showPromptInput, setShowPromptInput] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { upload, isUploading } = useImageUpload(userId)
  const hasRefs = character.reference_images.length > 0

  const lightboxImages: Array<LightboxImage> = character.reference_images
    .filter((img) => img.url)
    .map((img) => ({
      id: img.id,
      url: img.url!,
      title: `${character.name} reference`,
    }))

  const lightboxImageUrls: Record<string, string> = Object.fromEntries(
    character.reference_images
      .filter((img) => img.url)
      .map((img) => [img.id, img.url!]),
  )

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    await processAndUploadFiles(Array.from(files), async (input) => {
      const result = await upload(input)
      onAddRefImage({ id: result.id, url: result.url })
    })
  }

  return (
    <div
      className="rounded-lg border border-border bg-card p-3 space-y-2.5"
      onPointerDown={onFocus}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasRefs ? (
            <Check className="size-4 text-green-500" />
          ) : (
            <div className="size-4" />
          )}
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
                  className="size-20 cursor-pointer rounded object-cover"
                  onClick={() => {
                    const lightboxIdx = lightboxImages.findIndex(
                      (li) => li.id === img.id,
                    )
                    if (lightboxIdx >= 0) setLightboxIndex(lightboxIdx)
                  }}
                />
              ) : (
                <div className="flex size-20 items-center justify-center rounded bg-muted">
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

      {/* Lightbox */}
      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <Lightbox
          images={lightboxImages}
          imageUrls={lightboxImageUrls}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNext={() =>
            setLightboxIndex((i) =>
              i !== null ? Math.min(i + 1, lightboxImages.length - 1) : 0,
            )
          }
          onPrev={() =>
            setLightboxIndex((i) => (i !== null ? Math.max(i - 1, 0) : 0))
          }
          onDelete={() => {
            const img = lightboxImages[lightboxIndex]
            onRemoveRefImage(img.id)
            if (lightboxIndex >= lightboxImages.length - 1) {
              setLightboxIndex(
                lightboxImages.length > 1 ? lightboxIndex - 1 : null,
              )
            }
          }}
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
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
              title="Custom prompt"
            >
              <ImagePlus className="size-3.5" />
            </button>
            <button
              onClick={() => setShowLibrary(true)}
              className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Choose from library"
            >
              <Library className="size-3.5" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Upload image"
            >
              {isUploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </>
        )}
      </div>

      {/* Library picker dialog */}
      <ExistingImagePicker
        open={showLibrary}
        onOpenChange={setShowLibrary}
        images={existingImages.images}
        imageUrls={existingImages.imageUrls}
        isLoading={existingImages.isLoading}
        alreadyCollectedIds={
          new Set(character.reference_images.map((img) => img.id))
        }
        max={14 - character.reference_images.length}
        excludeIds={new Set(character.reference_images.map((img) => img.id))}
        onConfirm={(selected) => {
          for (const img of selected) {
            onAddRefImage({ id: img.id, url: img.url })
          }
          setShowLibrary(false)
        }}
      />
    </div>
  )
}
