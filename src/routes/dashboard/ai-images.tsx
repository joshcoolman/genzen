import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Settings } from 'lucide-react'
import { generateImage } from '@/features/ai-images/server/generate-image.server'
import { generatePromptServer } from '@/features/ai-images/server/generate-prompt.server'
import { generatePromptEnhanced } from '@/features/ai-images/server/generate-prompt-enhanced.server'
import type { PromptTheme } from '@/features/ai-images/lib/prompt-types'
import { generateVariation } from '@/features/ai-images/server/generate-variation.server'
import { checkPendingImages } from '@/features/ai-images/server/check-pending-images.server'
import {
  ALL_IMAGE_MODELS,
  DEFAULT_VISIBLE_MODELS,
  DEFAULT_MODEL,
  getVisibleModels,
} from '@/features/ai-images/models'
import { ModelSettingsDialog } from '@/features/ai-images/components/ModelSettingsDialog'
import { PendingImageCard } from '@/features/ai-images/components/PendingImageCard'
import { CreditBalance } from '@/components/CreditBalance'
import { useAuth } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/dashboard/ai-images')({
  component: AiImagesPage,
})

interface SavedAiImage {
  id: string
  title: string
  storage_path: string | null
  created_at: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  generation_error: string | null
  generation_metadata: {
    prompt: string
    model: string
    seed?: number
    elapsed?: number
    generation_type?: string
    source_image_id?: string
  } | null
}

function AiImagesPage() {
  const { user, session } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>(() => {
    // Load persisted model selections
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ai-image-selected-models')
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as string[]
          const validIds = parsed.filter((id) =>
            ALL_IMAGE_MODELS.some((m) => m.id === id),
          )
          if (validIds.length > 0) {
            return validIds
          }
        } catch {
          // Fall through to default
        }
      }
    }
    return [DEFAULT_MODEL]
  })
  const [loading, setLoading] = useState(false)
  const [generatingPrompt, setGeneratingPrompt] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<PromptTheme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ai-image-theme')
      if (stored === 'fantasy-scifi') return 'fantasy-scifi'
    }
    return 'general'
  })

  // Model visibility settings
  const [visibleModelIds, setVisibleModelIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('genzen:visible-models')
        if (stored) {
          const parsed = JSON.parse(stored) as string[]
          // Validate against ALL_IMAGE_MODELS
          const validIds = parsed.filter((id) =>
            ALL_IMAGE_MODELS.some((m) => m.id === id),
          )
          if (validIds.length > 0) {
            return validIds
          }
        }
      } catch {
        // Fallback to defaults
      }
    }
    return DEFAULT_VISIBLE_MODELS.map((m) => m.id)
  })

  const [settingsOpen, setSettingsOpen] = useState(false)
  const visibleModels = useMemo(
    () => getVisibleModels(visibleModelIds),
    [visibleModelIds],
  )

  // Saved AI images gallery
  const [savedImages, setSavedImages] = useState<SavedAiImage[]>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [loadingGallery, setLoadingGallery] = useState(true)
  const [generatingVariationFor, setGeneratingVariationFor] = useState<string | null>(null)

  const loadSavedImages = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoadingGallery(true)
      const { data, error: queryError } = await supabase
        .from('user_images')
        .select(
          'id, title, storage_path, created_at, status, generation_error, generation_metadata',
        )
        .eq('user_id', user.id)
        .eq('source', 'ai_generated')
        .order('created_at', { ascending: false })
        .limit(20)

      if (queryError) throw queryError

      const images = (data ?? []) as SavedAiImage[]
      setSavedImages(images)

      // Load signed URLs only for completed images
      const urls: Record<string, string> = {}
      for (const img of images) {
        if (img.status === 'completed' && img.storage_path) {
          const { data: urlData } = await supabase.storage
            .from('user-images')
            .createSignedUrl(img.storage_path, 3600)
          if (urlData) urls[img.id] = urlData.signedUrl
        }
      }
      setImageUrls(urls)
    } catch {
      console.error('Failed to load saved AI images')
    } finally {
      setLoadingGallery(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadSavedImages()
  }, [loadSavedImages])

  // Subscribe to Realtime updates for user_images table
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('user_images_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_images',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Handle INSERT, UPDATE, DELETE events
          if (payload.eventType === 'INSERT') {
            const newImage = payload.new as SavedAiImage
            setSavedImages((prev) => {
              // Prevent duplicates
              if (prev.some((img) => img.id === newImage.id)) return prev
              // If this is a variation, replace an optimistic placeholder instead of adding a new card
              const metadata = newImage.generation_metadata
              if (metadata?.generation_type === 'variation' && metadata?.source_image_id) {
                const sourceId = metadata.source_image_id
                const optimisticIdx = prev.findIndex((img) =>
                  img.id.startsWith(`optimistic-${sourceId}-`),
                )
                if (optimisticIdx !== -1) {
                  const updated = [...prev]
                  updated[optimisticIdx] = newImage
                  return updated.sort(
                    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                  )
                }
              }
              // Insert at correct sorted position (DESC by created_at)
              return [...prev, newImage].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
              )
            })
          } else if (payload.eventType === 'UPDATE') {
            const updatedImage = payload.new as SavedAiImage
            setSavedImages((prev) =>
              prev.map((img) => (img.id === updatedImage.id ? updatedImage : img))
            )

            // Load signed URL if image just completed
            if (updatedImage.status === 'completed' && updatedImage.storage_path) {
              supabase.storage
                .from('user-images')
                .createSignedUrl(updatedImage.storage_path, 3600)
                .then(({ data }) => {
                  if (data) {
                    setImageUrls((prev) => ({
                      ...prev,
                      [updatedImage.id]: data.signedUrl,
                    }))
                  }
                })
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id
            setSavedImages((prev) => prev.filter((img) => img.id !== deletedId))
            setImageUrls((prev) => {
              const newUrls = { ...prev }
              delete newUrls[deletedId]
              return newUrls
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // Background polling for pending images (fallback + trigger for completion check)
  useEffect(() => {
    if (!session?.access_token) return

    const pendingIds = savedImages
      .filter((img) => img.status === 'pending')
      .map((img) => img.id)

    if (pendingIds.length === 0) return

    const pollInterval = setInterval(async () => {
      try {
        await checkPendingImages({
          data: {
            accessToken: session.access_token,
            recordIds: pendingIds,
          },
        })
        // Don't refetch - Realtime will handle the updates
      } catch (error) {
        console.error('Error polling pending images:', error)
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
  }, [savedImages, session])

  // Persist model selections
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-image-selected-models', JSON.stringify(selectedModels))
    }
  }, [selectedModels])

  // Persist visible models selection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'genzen:visible-models',
        JSON.stringify(visibleModelIds),
      )
    }
  }, [visibleModelIds])

  // Persist theme selection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-image-theme', theme)
    }
  }, [theme])

  // Auto-update selected models if any become invisible
  useEffect(() => {
    const validSelections = selectedModels.filter((id) =>
      visibleModelIds.includes(id),
    )
    // If all selections became invisible, select the first visible model
    if (validSelections.length === 0 && visibleModelIds.length > 0) {
      setSelectedModels([visibleModelIds[0]])
    } else if (validSelections.length !== selectedModels.length) {
      // Some selections became invisible, keep only the valid ones
      setSelectedModels(validSelections)
    }
  }, [visibleModelIds, selectedModels])

  async function handleGenerate() {
    if (loading || !session?.access_token || selectedModels.length === 0) return

    setLoading(true)
    setError(null)

    try {
      // If prompt is empty, generate a random one silently (slot machine style!)
      let finalPrompt = prompt.trim()
      if (!finalPrompt) {
        const data = await generatePromptServer({
          data: { accessToken: session.access_token, theme },
        })
        finalPrompt = data.prompt
        // Don't set it in the input - keep it a surprise!
      }

      // Submit generation for each selected model
      // Each returns immediately with pending record
      // Realtime subscription will automatically add them to the UI
      await Promise.all(
        selectedModels.map((modelId) =>
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
    const { prompt, model: selectedModel } = img.generation_metadata

    setPrompt(prompt)
    setSelectedModels([selectedModel])

    // If the model isn't in the visible list, add it
    if (!visibleModelIds.includes(selectedModel)) {
      // Verify it's a valid model before adding
      if (ALL_IMAGE_MODELS.some((m) => m.id === selectedModel)) {
        setVisibleModelIds((prev) => [...prev, selectedModel])
      }
    }
  }

  async function handleMoreLikeThis(img: SavedAiImage) {
    if (!session?.access_token || !img.generation_metadata?.prompt || !img.generation_metadata?.model)
      return

    setError(null)
    setGeneratingVariationFor(img.id)

    // Optimistically insert 2 placeholder cards at the correct inline position immediately
    const optimisticIds = [`optimistic-${img.id}-0`, `optimistic-${img.id}-1`]
    const optimisticCards: SavedAiImage[] = [0, 1].map((i) => ({
      id: optimisticIds[i],
      title: 'Generating variation...',
      storage_path: null,
      created_at: new Date(new Date(img.created_at).getTime() + (i + 1) * 1000).toISOString(),
      status: 'pending',
      generation_error: null,
      generation_metadata: {
        prompt: img.generation_metadata!.prompt,
        model: img.generation_metadata!.model,
      },
    }))
    setSavedImages((prev) =>
      [...prev, ...optimisticCards].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    )

    try {
      const results = await generateVariation({
        data: {
          accessToken: session.access_token,
          prompt: img.generation_metadata.prompt,
          model: img.generation_metadata.model,
          sourceImageId: img.id,
        },
      })

      // Replace optimistic placeholders with real pending records
      // Also filter out real IDs already inserted by Realtime to avoid duplicates
      setSavedImages((prev) => {
        const realIds = results.map((r) => r.recordId)
        const filtered = prev.filter(
          (i) => !optimisticIds.includes(i.id) && !realIds.includes(i.id),
        )
        const realCards: SavedAiImage[] = results.map((r, i) => ({
          id: r.recordId,
          title: 'Generating variation...',
          storage_path: null,
          created_at: new Date(new Date(img.created_at).getTime() + (i + 1) * 1000).toISOString(),
          status: 'pending',
          generation_error: null,
          generation_metadata: {
            prompt: img.generation_metadata!.prompt,
            model: img.generation_metadata!.model,
          },
        }))
        return [...filtered, ...realCards].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
      })
    } catch (err) {
      // Remove optimistic cards on failure
      setSavedImages((prev) => prev.filter((i) => !optimisticIds.includes(i.id)))
      setError(err instanceof Error ? err.message : 'Failed to generate variations')
    } finally {
      setGeneratingVariationFor(null)
    }
  }

  async function handleDelete(img: SavedAiImage) {
    // Optimistic removal from UI
    setSavedImages((prev) => prev.filter((i) => i.id !== img.id))

    try {
      // Delete DB record
      const { error: deleteError } = await supabase
        .from('user_images')
        .delete()
        .eq('id', img.id)

      if (deleteError) throw deleteError

      // Delete storage file (best effort)
      await supabase.storage.from('user-images').remove([img.storage_path])
    } catch {
      // Rollback on failure
      loadSavedImages()
    }
  }

  async function handleRandomPrompt() {
    if (generatingPrompt || !session?.access_token) return

    setGeneratingPrompt(true)
    setError(null)

    try {
      const data = await generatePromptServer({
        data: { accessToken: session.access_token, theme },
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

      // Log cost for development
      if (data.metadata?.cost) {
        console.log(`Prompt enhancement cost: $${data.metadata.cost.toFixed(6)}`)
        console.log(`Tokens: ${data.metadata.inputTokens} in, ${data.metadata.outputTokens} out`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enhance prompt')
    } finally {
      setGeneratingPrompt(false)
    }
  }

  function getModelName(modelId: string) {
    return ALL_IMAGE_MODELS.find((m) => m.id === modelId)?.name ?? modelId
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
                    checked={theme === 'general'}
                    onChange={() => setTheme('general')}
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
                    checked={theme === 'fantasy-scifi'}
                    onChange={() => setTheme('fantasy-scifi')}
                    disabled={loading}
                    className="h-3.5 w-3.5 cursor-pointer"
                  />
                  <span className="text-muted-foreground">Fantasy / Sci-Fi</span>
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
              disabled={loading || selectedModels.length === 0}
              className="w-full"
            >
              {loading
                ? selectedModels.length > 1
                  ? `Generating ${selectedModels.length} images...`
                  : 'Generating...'
                : selectedModels.length > 1
                  ? `Generate ${selectedModels.length} images`
                  : 'Generate'}
            </Button>

            {error && (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {loading && (
              <p className="text-sm text-muted-foreground">
                {selectedModels.length > 1
                  ? `Generating ${selectedModels.length} images, this may take a moment...`
                  : 'Generating image, this may take a moment...'}
              </p>
            )}
          </div>

          {/* Right Column: Model Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-muted-foreground">
                Models ({selectedModels.length} selected)
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(true)}
                disabled={loading}
                title="Configure visible models"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {visibleModels.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-2 rounded border border-input px-2.5 py-1.5 cursor-pointer hover:bg-accent/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    value={m.id}
                    checked={selectedModels.includes(m.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedModels([...selectedModels, m.id])
                      } else {
                        // Don't allow unchecking if it's the last selected model
                        if (selectedModels.length > 1) {
                          setSelectedModels(
                            selectedModels.filter((id) => id !== m.id),
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

        {loadingGallery ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : savedImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
            <h3 className="mb-2 text-lg font-semibold text-foreground">
              No saved images yet
            </h3>
            <p className="text-sm text-muted-foreground">
              Generate an image to see it here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {savedImages.map((img) =>
              img.status === 'pending' ? (
                <PendingImageCard
                  key={img.id}
                  prompt={img.generation_metadata?.prompt ?? ''}
                  model={getModelName(img.generation_metadata?.model ?? '')}
                  isVariation={img.generation_metadata?.generation_type === 'variation'}
                />
              ) : img.status === 'failed' ? (
                <div
                  key={img.id}
                  className="group relative overflow-hidden rounded-lg border border-destructive/50 bg-card"
                >
                  <div className="aspect-square flex items-center justify-center bg-destructive/10 p-4">
                    <div className="text-center space-y-2">
                      <p className="text-sm font-medium text-destructive">
                        Generation Failed
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {img.generation_error ?? 'Unknown error'}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {img.generation_metadata?.prompt ?? img.title}
                    </p>
                  </div>
                  {/* Delete button */}
                  <button
                    onClick={() => handleDelete(img)}
                    className="absolute top-1.5 right-1.5 rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    aria-label="Delete failed generation"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  key={img.id}
                  className="group relative overflow-hidden rounded-lg border border-border bg-card"
                >
                  <div className="relative">
                    {imageUrls[img.id] ? (
                      <img
                        src={imageUrls[img.id]}
                        alt={img.title}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-square w-full bg-muted animate-pulse" />
                    )}
                    {img.generation_metadata?.generation_type === 'variation' && (
                      <span className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-full">
                        Variation
                      </span>
                    )}
                    {/* Delete button */}
                    <button
                      onClick={() => handleDelete(img)}
                      className="absolute top-1.5 right-1.5 rounded bg-background/80 backdrop-blur-sm p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                      aria-label="Delete image"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
                    {/* Action buttons overlay */}
                    <div className="absolute inset-x-0 bottom-0 flex gap-1 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleLoadPrompt(img)}
                        className="flex-1 rounded bg-background/80 backdrop-blur-sm px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-background/95 transition-colors"
                      >
                        Prompt
                      </button>
                      <button
                        onClick={() => handleLoadPromptAndModel(img)}
                        className="flex-1 rounded bg-background/80 backdrop-blur-sm px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-background/95 transition-colors"
                      >
                        P+M
                      </button>
                      <button
                        onClick={() => handleMoreLikeThis(img)}
                        disabled={generatingVariationFor === img.id}
                        className="flex-1 rounded bg-background/80 backdrop-blur-sm px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-background/95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generatingVariationFor === img.id ? '...' : 'More'}
                      </button>
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {img.generation_metadata?.prompt ?? img.title}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground/60">
                      <span>
                        {img.generation_metadata
                          ? getModelName(img.generation_metadata.model)
                          : ''}
                      </span>
                      <span>
                        {new Date(img.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* Model Settings Dialog */}
      <ModelSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        visibleModels={visibleModelIds}
        onSaveVisibleModels={setVisibleModelIds}
      />
    </div>
  )
}
