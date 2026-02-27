import { createFileRoute } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import {
  ImagePlus,
  RectangleHorizontal,
  RectangleVertical,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import type { DragEndEvent } from '@dnd-kit/core'
import type { SavedAiImage } from '@/features/ai-images/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { generateImage } from '@/features/ai-images/server/generate-image.server'
import { captionImage } from '@/features/ai-images/server/caption-image.server'
import { editImage } from '@/features/ai-images/server/edit-image.server'
import { generatePromptServer } from '@/features/ai-images/server/generate-prompt.server'
import { generatePromptEnhanced } from '@/features/ai-images/server/generate-prompt-enhanced.server'
import { generateVariation } from '@/features/ai-images/server/generate-variation.server'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ALL_IMAGE_MODELS,
  IMAGE_INPUT_MODELS,
} from '@/features/ai-images/models'
import { ModelSettingsDialog } from '@/features/ai-images/components/ModelSettingsDialog'
import { PendingImageCard } from '@/features/ai-images/components/PendingImageCard'
import { ImageCard } from '@/features/ai-images/components/ImageCard'
import { ImageLightbox } from '@/features/ai-images/components/ImageLightbox'
import { FailedImageCard } from '@/features/ai-images/components/FailedImageCard'
import { useImages } from '@/features/ai-images/hooks/use-images'
import { useModelSettings } from '@/features/ai-images/hooks/use-model-settings'
import { CreditBalance } from '@/components/CreditBalance'
import { useAuth } from '@/lib/auth'

export const Route = createFileRoute('/dashboard/ai-images')({
  component: AiImagesPage,
})

function getModelName(modelId: string) {
  return ALL_IMAGE_MODELS.find((m) => m.id === modelId)?.name ?? modelId
}

function AiImagesPage() {
  const { user, session } = useAuth()
  const gallery = useImages({
    userId: user?.id,
    accessToken: session?.access_token,
  })
  const modelSettings = useModelSettings()

  const [prompt, setPrompt] = useState('')
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>(
    'landscape',
  )
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [loading, setLoading] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [sourceImage, setSourceImage] = useState<{
    base64: string
    name: string
  } | null>(null)
  const [imageSelectedModels, setImageSelectedModels] = useState<Array<string>>(
    [],
  )
  const [describingImage, setDescribingImage] = useState(false)
  const [editTarget, setEditTarget] = useState<SavedAiImage | null>(null)
  const [editPrompt, setEditPrompt] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editOrientation, setEditOrientation] = useState<
    'landscape' | 'portrait'
  >('landscape')
  const [editAspectRatio, setEditAspectRatio] = useState('16:9')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const inputMode = sourceImage ? 'image' : 'text'
  const canGenerate =
    inputMode === 'image'
      ? imageSelectedModels.length > 0
      : !!prompt.trim() && modelSettings.selectedModels.length > 0

  const landscapeRatios = ['16:9', '2:1', '3:2', '4:3', '21:9', '1:1']
  const portraitRatios = ['9:16', '1:2', '2:3', '3:4', '1:1']
  const flipMap: Record<string, string> = {
    '16:9': '9:16',
    '2:1': '1:2',
    '3:2': '2:3',
    '4:3': '3:4',
    '21:9': '9:16',
    '9:16': '16:9',
    '1:2': '2:1',
    '2:3': '3:2',
    '3:4': '4:3',
    '1:1': '1:1',
  }

  function handleOrientationToggle() {
    const next = orientation === 'landscape' ? 'portrait' : 'landscape'
    setOrientation(next)
    setAspectRatio(
      flipMap[aspectRatio] ?? (next === 'landscape' ? '16:9' : '9:16'),
    )
  }

  const ratioOptions =
    orientation === 'landscape' ? landscapeRatios : portraitRatios
  const [generatingPrompt, setGeneratingPrompt] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatingVariationFor, setGeneratingVariationFor] = useState<
    string | null
  >(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const sorted = gallery.images
    const oldIndex = sorted.findIndex((i) => i.id === active.id)
    const newIndex = sorted.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // After drop, the dragged item should land at newIndex
    // Neighbors in the sorted array (excluding the dragged item) are at newIndex-1 and newIndex
    const withoutDragged = sorted.filter((_, i) => i !== oldIndex)
    const insertBefore = oldIndex < newIndex ? newIndex : newIndex - 1
    const prev = withoutDragged[insertBefore - 1]?.sort_order
    const next = withoutDragged[insertBefore]?.sort_order

    let newSortOrder: number
    if (prev != null && next != null) {
      newSortOrder = (prev + next) / 2
    } else if (prev != null) {
      newSortOrder = prev - 1
    } else if (next != null) {
      newSortOrder = next + 1
    } else {
      newSortOrder = Date.now() / 1000
    }

    void gallery.reorderImages(active.id as string, newSortOrder)
  }

  const completedImages = gallery.images.filter(
    (img) => img.status === 'completed',
  )

  function handleOpenLightbox(img: SavedAiImage) {
    const idx = completedImages.findIndex((i) => i.id === img.id)
    if (idx !== -1) setLightboxIndex(idx)
  }

  async function handleGenerate() {
    if (loading || !session?.access_token || !canGenerate) return

    setLoading(true)
    setError(null)

    try {
      const finalPrompt = prompt.trim()
      const modelsToUse =
        inputMode === 'image'
          ? imageSelectedModels
          : modelSettings.selectedModels

      await Promise.all(
        modelsToUse.map((modelId) =>
          generateImage({
            data: {
              prompt: finalPrompt,
              model: modelId,
              accessToken: session.access_token,
              aspectRatio,
              ...(sourceImage ? { sourceImageBase64: sourceImage.base64 } : {}),
            },
          }),
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate image')
    } finally {
      setLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string
      setSourceImage({ base64, name: file.name })
      setImageSelectedModels(['fal-ai/nano-banana-pro'])
      setPrompt('')

      // Snap orientation + aspect ratio to closest match for source image
      const img = new Image()
      img.onload = () => {
        const { naturalWidth: w, naturalHeight: h } = img
        if (!w || !h) return
        const ratio = w / h
        const isLandscape = ratio >= 1
        const nextOrientation = isLandscape ? 'landscape' : 'portrait'
        const candidates = isLandscape ? landscapeRatios : portraitRatios
        function parseRatio(r: string) {
          const [a, b] = r.split(':').map(Number)
          return a / b
        }
        const closest = candidates.reduce((best, r) =>
          Math.abs(parseRatio(r) - ratio) < Math.abs(parseRatio(best) - ratio)
            ? r
            : best,
        )
        setOrientation(nextOrientation)
        setAspectRatio(closest)
      }
      img.src = base64

      // Auto-caption the image and populate the prompt textarea
      if (session?.access_token) {
        setDescribingImage(true)
        captionImage({
          data: { imageBase64: base64, accessToken: session.access_token },
        })
          .then(({ caption }) => setPrompt(caption))
          .catch(() => {
            /* leave prompt empty, server will describe on generate */
          })
          .finally(() => setDescribingImage(false))
      }
    }
    reader.readAsDataURL(file)
    // Reset file input so the same file can be re-selected
    e.target.value = ''
  }

  function handleClearSourceImage() {
    setSourceImage(null)
    setImageSelectedModels([])
    setPrompt('')
  }

  function handleEdit(img: SavedAiImage) {
    setEditTarget(img)
    setEditPrompt('')
    // Seed orientation/ratio from source image metadata if available
    const srcRatio = img.generation_metadata?.aspect_ratio as string | undefined
    if (srcRatio) {
      const [a, b] = srcRatio.split(':').map(Number)
      const isLandscape = a >= b
      setEditOrientation(isLandscape ? 'landscape' : 'portrait')
      setEditAspectRatio(srcRatio)
    } else {
      setEditOrientation(orientation)
      setEditAspectRatio(aspectRatio)
    }
  }

  async function handleEditSubmit() {
    if (!editTarget || !editPrompt.trim() || !session?.access_token) return
    setEditLoading(true)
    try {
      await editImage({
        data: {
          accessToken: session.access_token,
          sourceImageId: editTarget.id,
          editPrompt: editPrompt.trim(),
          aspectRatio: editAspectRatio,
        },
      })
      setEditTarget(null)
      setEditPrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit image')
      setEditTarget(null)
    } finally {
      setEditLoading(false)
    }
  }

  function handleLoadPrompt(img: SavedAiImage) {
    if (!img.generation_metadata?.prompt) return
    setPrompt(img.generation_metadata.prompt)
  }

  function handleLoadPromptAndModel(img: SavedAiImage) {
    if (!img.generation_metadata) return
    const { prompt: imgPrompt, model: selectedModel } = img.generation_metadata
    setPrompt(imgPrompt)
    modelSettings.setSelectedModels([selectedModel])
    if (!modelSettings.visibleModelIds.includes(selectedModel)) {
      if (ALL_IMAGE_MODELS.some((m) => m.id === selectedModel)) {
        modelSettings.setVisibleModelIds((prev) => [...prev, selectedModel])
      }
    }
  }

  async function handleMoreLikeThis(img: SavedAiImage, count: number) {
    if (
      !session?.access_token ||
      !img.generation_metadata?.prompt ||
      !img.generation_metadata.model
    )
      return

    setError(null)
    setGeneratingVariationFor(img.id)

    const optimisticIds = Array.from(
      { length: count },
      (_, i) => `optimistic-${img.id}-${i}`,
    )
    for (const optimisticId of optimisticIds) {
      gallery.addOptimisticCard({
        id: optimisticId,
        title: 'Generating variation...',
        storage_path: null,
        created_at: new Date(
          new Date(img.created_at).getTime() + 1000,
        ).toISOString(),
        status: 'pending',
        generation_error: null,
        generation_metadata: {
          prompt: img.generation_metadata.prompt,
          model: img.generation_metadata.model,
          generation_type: 'variation',
          source_image_id: img.id,
        },
      })
    }

    try {
      const results = await generateVariation({
        data: {
          accessToken: session.access_token,
          prompt: img.generation_metadata.prompt,
          model: img.generation_metadata.model,
          sourceImageId: img.id,
          count,
        },
      })

      for (let i = 0; i < results.length; i++) {
        const realCard: SavedAiImage = {
          id: results[i].recordId,
          title: 'Generating variation...',
          storage_path: null,
          created_at: new Date(
            new Date(img.created_at).getTime() + 1000,
          ).toISOString(),
          status: 'pending',
          generation_error: null,
          generation_metadata: {
            prompt: img.generation_metadata.prompt,
            model: img.generation_metadata.model,
          },
        }
        gallery.replaceOptimisticCard(optimisticIds[i], realCard)
      }
      // Remove any leftover optimistic cards if fewer results returned
      for (let i = results.length; i < optimisticIds.length; i++) {
        gallery.removeOptimisticCard(optimisticIds[i])
      }
    } catch (err) {
      for (const optimisticId of optimisticIds) {
        gallery.removeOptimisticCard(optimisticId)
      }
      setError(
        err instanceof Error ? err.message : 'Failed to generate variations',
      )
    } finally {
      setGeneratingVariationFor(null)
    }
  }

  async function handleRandomPrompt() {
    if (generatingPrompt || !session?.access_token) return
    setGeneratingPrompt(true)
    setError(null)
    try {
      const data = await generatePromptServer({
        data: { accessToken: session.access_token, theme: 'general' },
      })
      setPrompt(data.prompt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompt')
    } finally {
      setGeneratingPrompt(false)
    }
  }

  async function handleEnhancedPrompt() {
    if (generatingPrompt || !session?.access_token || !prompt.trim()) return
    setGeneratingPrompt(true)
    setError(null)
    try {
      const data = await generatePromptEnhanced({
        data: {
          accessToken: session.access_token,
          currentPrompt: prompt.trim(),
        },
      })
      setPrompt(data.prompt)
      if (data.metadata.cost) {
        console.log(
          `Prompt enhancement cost: $${data.metadata.cost.toFixed(6)}`,
        )
        console.log(
          `Tokens: ${data.metadata.inputTokens} in, ${data.metadata.outputTokens} out`,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enhance prompt')
    } finally {
      setGeneratingPrompt(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI Images</h1>
        <CreditBalance />
      </div>

      {/* Generator */}
      <div className="bg-card rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Prompt */}
          <div className="space-y-3">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Source image preview strip */}
            {sourceImage && (
              <div className="flex items-center gap-2 rounded border border-input bg-muted/50 px-2.5 py-1.5">
                <img
                  src={sourceImage.base64}
                  alt="Source"
                  className="h-10 w-10 rounded object-cover shrink-0"
                />
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {sourceImage.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={handleClearSourceImage}
                  title="Remove source image"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            <Textarea
              id="prompt-textarea"
              placeholder={
                describingImage
                  ? 'Describing image...'
                  : inputMode === 'image'
                    ? 'Edit prompt (optional)...'
                    : 'Describe your image...'
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={loading || describingImage}
              rows={sourceImage ? 6 : 8}
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleRandomPrompt}
                disabled={generatingPrompt || inputMode === 'image'}
                title={
                  inputMode === 'image'
                    ? 'Not available in image mode'
                    : 'Generate a random prompt'
                }
                className="shrink-0"
              >
                <Sparkles className="h-4 w-4 mr-1.5" />
                {generatingPrompt ? 'Generating...' : 'Prompt'}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                title="Upload source image"
                className={`shrink-0 ${inputMode === 'image' ? 'border-primary text-primary' : ''}`}
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleOrientationToggle}
                disabled={loading}
                title={`Switch to ${orientation === 'landscape' ? 'portrait' : 'landscape'}`}
                className="shrink-0"
              >
                {orientation === 'landscape' ? (
                  <RectangleHorizontal className="h-4 w-4" />
                ) : (
                  <RectangleVertical className="h-4 w-4" />
                )}
              </Button>
              <Select
                value={aspectRatio}
                onValueChange={setAspectRatio}
                disabled={loading}
              >
                <SelectTrigger className="w-24 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ratioOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleGenerate}
                disabled={loading || !canGenerate}
                className="flex-1"
              >
                {loading
                  ? (inputMode === 'image'
                      ? imageSelectedModels
                      : modelSettings.selectedModels
                    ).length > 1
                    ? `Generating ${(inputMode === 'image' ? imageSelectedModels : modelSettings.selectedModels).length} images...`
                    : 'Generating...'
                  : (inputMode === 'image'
                        ? imageSelectedModels
                        : modelSettings.selectedModels
                      ).length > 1
                    ? `Generate ${(inputMode === 'image' ? imageSelectedModels : modelSettings.selectedModels).length} images`
                    : 'Generate'}
              </Button>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>

          {/* Right Column: Model Selection */}
          <div className="space-y-2">
            {inputMode === 'image' ? (
              <>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Models — image input ({imageSelectedModels.length} selected)
                  </label>
                </div>
                <div className="space-y-1">
                  {IMAGE_INPUT_MODELS.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 rounded border border-input px-2.5 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        value={m.id}
                        checked={imageSelectedModels.includes(m.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setImageSelectedModels([
                              ...imageSelectedModels,
                              m.id,
                            ])
                          } else {
                            setImageSelectedModels(
                              imageSelectedModels.filter((id) => id !== m.id),
                            )
                          }
                        }}
                        disabled={loading}
                        className="h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="text-xs font-medium">{m.name}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-muted-foreground">
                    Models ({modelSettings.selectedModels.length} selected)
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => modelSettings.setSettingsOpen(true)}
                    disabled={loading}
                    title="Configure visible models"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {modelSettings.visibleModels.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-center gap-2 rounded border border-input px-2.5 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <input
                        type="checkbox"
                        value={m.id}
                        checked={modelSettings.selectedModels.includes(m.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            modelSettings.setSelectedModels([
                              ...modelSettings.selectedModels,
                              m.id,
                            ])
                          } else {
                            if (modelSettings.selectedModels.length > 1) {
                              modelSettings.setSelectedModels(
                                modelSettings.selectedModels.filter(
                                  (id) => id !== m.id,
                                ),
                              )
                            }
                          }
                        }}
                        disabled={loading}
                        className="h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <span className="text-xs font-medium">{m.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Saved AI Images Gallery */}
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Recent Generations</h2>

        {gallery.loadingGallery ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : gallery.images.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              No saved images yet
            </h3>
            <p className="text-sm text-muted-foreground">
              Generate an image to see it here
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={gallery.images.map((i) => i.id)}
              strategy={rectSortingStrategy}
            >
              <div
                className="grid gap-4"
                style={{
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                }}
              >
                {gallery.images.map((img) =>
                  img.status === 'pending' ? (
                    <PendingImageCard
                      key={img.id}
                      prompt={img.generation_metadata?.prompt ?? ''}
                      model={getModelName(img.generation_metadata?.model ?? '')}
                      isVariation={
                        img.generation_metadata?.generation_type === 'variation'
                      }
                      sourceImageUrl={
                        img.generation_metadata?.source_image_id
                          ? gallery.imageUrls[
                              img.generation_metadata.source_image_id
                            ]
                          : undefined
                      }
                    />
                  ) : img.status === 'failed' ? (
                    <FailedImageCard
                      key={img.id}
                      img={img}
                      onDelete={gallery.deleteImage}
                    />
                  ) : (
                    <ImageCard
                      key={img.id}
                      img={img}
                      imageUrl={gallery.imageUrls[img.id]}
                      generatingVariation={generatingVariationFor === img.id}
                      onOpen={handleOpenLightbox}
                      onLoadPrompt={handleLoadPrompt}
                      onLoadPromptAndModel={handleLoadPromptAndModel}
                      onMoreLikeThis={handleMoreLikeThis}
                      onEdit={handleEdit}
                      onDelete={gallery.deleteImage}
                      getModelName={getModelName}
                    />
                  ),
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <ModelSettingsDialog
        open={modelSettings.settingsOpen}
        onOpenChange={modelSettings.setSettingsOpen}
        visibleModels={modelSettings.visibleModelIds}
        onSaveVisibleModels={modelSettings.setVisibleModelIds}
      />

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null)
            setEditPrompt('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editTarget && (
              <img
                src={gallery.imageUrls[editTarget.id]}
                alt="Editing"
                className="w-full rounded-md object-contain max-h-64 bg-black"
              />
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  const next =
                    editOrientation === 'landscape' ? 'portrait' : 'landscape'
                  setEditOrientation(next)
                  setEditAspectRatio(
                    flipMap[editAspectRatio] ??
                      (next === 'landscape' ? '16:9' : '9:16'),
                  )
                }}
                disabled={editLoading}
                title={`Switch to ${editOrientation === 'landscape' ? 'portrait' : 'landscape'}`}
                className="shrink-0"
              >
                {editOrientation === 'landscape' ? (
                  <RectangleHorizontal className="h-4 w-4" />
                ) : (
                  <RectangleVertical className="h-4 w-4" />
                )}
              </Button>
              <Select
                value={editAspectRatio}
                onValueChange={setEditAspectRatio}
                disabled={editLoading}
              >
                <SelectTrigger className="w-24 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(editOrientation === 'landscape'
                    ? landscapeRatios
                    : portraitRatios
                  ).map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder="Describe the edit — e.g. make the woman smile, change background to sunset..."
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              disabled={editLoading}
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  void handleEditSubmit()
                }
              }}
            />
            <Button
              onClick={handleEditSubmit}
              disabled={!editPrompt.trim() || editLoading}
              className="w-full"
            >
              {editLoading ? 'Submitting...' : 'Generate Edit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={completedImages}
          imageUrls={gallery.imageUrls}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNext={() =>
            setLightboxIndex((i) =>
              i !== null ? (i + 1) % completedImages.length : null,
            )
          }
          onPrev={() =>
            setLightboxIndex((i) =>
              i !== null
                ? (i - 1 + completedImages.length) % completedImages.length
                : null,
            )
          }
          getModelName={getModelName}
        />
      )}
    </div>
  )
}
