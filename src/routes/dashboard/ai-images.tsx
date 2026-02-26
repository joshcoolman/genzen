import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Settings } from 'lucide-react'
import type { SavedAiImage } from '@/features/ai-images/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { generateImage } from '@/features/ai-images/server/generate-image.server'
import { generatePromptServer } from '@/features/ai-images/server/generate-prompt.server'
import { generatePromptEnhanced } from '@/features/ai-images/server/generate-prompt-enhanced.server'
import { generateVariation } from '@/features/ai-images/server/generate-variation.server'
import { ALL_IMAGE_MODELS } from '@/features/ai-images/models'
import { ModelSettingsDialog } from '@/features/ai-images/components/ModelSettingsDialog'
import { PendingImageCard } from '@/features/ai-images/components/PendingImageCard'
import { ImageCard } from '@/features/ai-images/components/ImageCard'
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
  const [loading, setLoading] = useState(false)
  const [generatingPrompt, setGeneratingPrompt] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatingVariationFor, setGeneratingVariationFor] = useState<
    string | null
  >(null)

  async function handleGenerate() {
    if (
      loading ||
      !session?.access_token ||
      modelSettings.selectedModels.length === 0
    )
      return

    setLoading(true)
    setError(null)

    try {
      let finalPrompt = prompt.trim()
      if (!finalPrompt) {
        const data = await generatePromptServer({
          data: {
            accessToken: session.access_token,
            theme: modelSettings.theme,
          },
        })
        finalPrompt = data.prompt
      }

      await Promise.all(
        modelSettings.selectedModels.map((modelId) =>
          generateImage({
            data: {
              prompt: finalPrompt,
              model: modelId,
              accessToken: session.access_token,
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

  async function handleMoreLikeThis(img: SavedAiImage) {
    if (
      !session?.access_token ||
      !img.generation_metadata?.prompt ||
      !img.generation_metadata.model
    )
      return

    setError(null)
    setGeneratingVariationFor(img.id)

    const optimisticId = `optimistic-${img.id}-0`
    const optimisticCard: SavedAiImage = {
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
    }
    gallery.addOptimisticCard(optimisticCard)

    try {
      const results = await generateVariation({
        data: {
          accessToken: session.access_token,
          prompt: img.generation_metadata.prompt,
          model: img.generation_metadata.model,
          sourceImageId: img.id,
        },
      })

      const realCard: SavedAiImage = {
        id: results[0].recordId,
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
      gallery.replaceOptimisticCard(optimisticId, realCard)
    } catch (err) {
      gallery.removeOptimisticCard(optimisticId)
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
        data: { accessToken: session.access_token, theme: modelSettings.theme },
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
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="prompt-textarea"
                  className="block text-sm font-medium text-muted-foreground"
                >
                  Prompt
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRandomPrompt}
                  disabled={generatingPrompt || loading}
                  title="Generate a random photography prompt with AI"
                >
                  {generatingPrompt ? 'Generating...' : 'Random Prompt'}
                </Button>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="prompt-theme"
                    value="general"
                    checked={modelSettings.theme === 'general'}
                    onChange={() => modelSettings.setTheme('general')}
                    disabled={loading}
                    className="h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="text-muted-foreground">General</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="prompt-theme"
                    value="fantasy-scifi"
                    checked={modelSettings.theme === 'fantasy-scifi'}
                    onChange={() => modelSettings.setTheme('fantasy-scifi')}
                    disabled={loading}
                    className="h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="text-muted-foreground">
                    Fantasy / Sci-Fi
                  </span>
                </label>
              </div>
              <Textarea
                id="prompt-textarea"
                placeholder="Prompt for image, or just click Generate for a surprise"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
                rows={8}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading || modelSettings.selectedModels.length === 0}
              className="w-full"
            >
              {loading
                ? modelSettings.selectedModels.length > 1
                  ? `Generating ${modelSettings.selectedModels.length} images...`
                  : 'Generating...'
                : modelSettings.selectedModels.length > 1
                  ? `Generate ${modelSettings.selectedModels.length} images`
                  : 'Generate'}
            </Button>

            {error && (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {loading && (
              <p className="text-sm text-muted-foreground">
                {modelSettings.selectedModels.length > 1
                  ? `Generating ${modelSettings.selectedModels.length} images, this may take a moment...`
                  : 'Generating image, this may take a moment...'}
              </p>
            )}
          </div>

          {/* Right Column: Model Selection */}
          <div className="space-y-2">
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
                  onLoadPrompt={handleLoadPrompt}
                  onLoadPromptAndModel={handleLoadPromptAndModel}
                  onMoreLikeThis={handleMoreLikeThis}
                  onDelete={gallery.deleteImage}
                  getModelName={getModelName}
                />
              ),
            )}
          </div>
        )}
      </div>

      <ModelSettingsDialog
        open={modelSettings.settingsOpen}
        onOpenChange={modelSettings.setSettingsOpen}
        visibleModels={modelSettings.visibleModelIds}
        onSaveVisibleModels={modelSettings.setVisibleModelIds}
      />
    </div>
  )
}
