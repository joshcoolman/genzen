import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Settings } from 'lucide-react'
import {
  generateImage,
  generatePrompt,
} from '@/features/ai-images/server/generate-image.server'
import { checkPendingImages } from '@/features/ai-images/server/check-pending-images.server'
import {
  ALL_IMAGE_MODELS,
  DEFAULT_VISIBLE_MODELS,
  DEFAULT_MODEL,
  getVisibleModels,
} from '@/features/ai-images/models'
import { ModelSettingsDialog } from '@/features/ai-images/components/ModelSettingsDialog'
import { PendingImageCard } from '@/features/ai-images/components/PendingImageCard'
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
  } | null
}

function AiImagesPage() {
  const { user, session } = useAuth()
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState(() => {
    // Load persisted model selection
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ai-image-model')
      if (stored && ALL_IMAGE_MODELS.some((m) => m.id === stored)) {
        return stored
      }
    }
    return DEFAULT_MODEL
  })
  const [loading, setLoading] = useState(false)
  const [generatingPrompt, setGeneratingPrompt] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
              if (prev.some((img) => img.id === newImage.id)) {
                return prev
              }
              return [newImage, ...prev]
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

  // Persist model selection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ai-image-model', model)
    }
  }, [model])

  // Persist visible models selection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'genzen:visible-models',
        JSON.stringify(visibleModelIds),
      )
    }
  }, [visibleModelIds])

  // Auto-switch model if current selection becomes invisible
  useEffect(() => {
    if (!visibleModelIds.includes(model) && visibleModelIds.length > 0) {
      setModel(visibleModelIds[0])
    }
  }, [visibleModelIds, model])

  // Generate random prompt on mount
  useEffect(() => {
    async function loadInitialPrompt() {
      if (!session?.access_token) return

      try {
        const data = await generatePrompt({
          data: { accessToken: session.access_token },
        })
        setPrompt(data.prompt)
      } catch {
        // Silently fail - user can generate their own
      }
    }
    loadInitialPrompt()
  }, [session?.access_token])

  async function handleGenerate() {
    if (!prompt.trim() || loading || !session?.access_token) return

    setLoading(true)
    setError(null)

    try {
      // Submit generation (returns immediately with pending record)
      // Realtime subscription will automatically add it to the UI
      await generateImage({
        data: {
          prompt: prompt.trim(),
          model,
          accessToken: session.access_token,
        },
      })
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
    setPrompt(img.generation_metadata.prompt)
    setModel(img.generation_metadata.model)
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
      const data = await generatePrompt({
        data: { accessToken: session.access_token },
      })
      setPrompt(data.prompt)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate prompt')
    } finally {
      setGeneratingPrompt(false)
    }
  }

  function getModelName(modelId: string) {
    return ALL_IMAGE_MODELS.find((m) => m.id === modelId)?.name ?? modelId
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">AI Images</h1>

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
                >
                  {generatingPrompt ? 'Generating...' : 'Random Prompt'}
                </Button>
              </div>
              <Textarea
                id="prompt-textarea"
                placeholder="Describe the image you want to generate..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
                rows={8}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading}
              className="w-full"
            >
              {loading ? 'Generating...' : 'Generate'}
            </Button>

            {error && (
              <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {loading && (
              <p className="text-sm text-muted-foreground">
                Generating image, this may take a moment...
              </p>
            )}
          </div>

          {/* Right Column: Model Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-muted-foreground">
                Model
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
                    type="radio"
                    name="model"
                    value={m.id}
                    checked={model === m.id}
                    onChange={(e) => setModel(e.target.value)}
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
