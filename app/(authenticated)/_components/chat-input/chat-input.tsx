'use client'

import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Send, Square, X } from 'lucide-react'
import type { ADImage } from '#/features/ad/hooks/useADChat'
import type { ImageSourceResult } from '#/components'
import { ImageSourceDialog } from '#/components'
import { useAuth } from '#/lib/auth'
import { useUserImages } from '#/features/user-images/hooks/useUserImages'

interface ChatInputProps {
  onSend: (text: string, images?: Array<ADImage>) => void
  onAbort: () => void
  isStreaming: boolean
}

export function ChatInput({ onSend, onAbort, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [pendingImages, setPendingImages] = useState<Array<ADImage>>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { user } = useAuth()
  const userImages = useUserImages(user.id)

  const handleUploadToLibrary = useCallback(
    async (file: File) => {
      await userImages.create({ file, title: file.name })
    },
    [userImages],
  )

  const handleSelectImage = useCallback((result: ImageSourceResult) => {
    setPendingImages((prev) => {
      // Dedupe by library row id
      if (prev.some((img) => img.id === result.id)) return prev
      return [...prev, { id: result.id, url: result.url, title: result.title }]
    })
  }, [])

  const handleSubmit = useCallback(() => {
    if ((!value.trim() && pendingImages.length === 0) || isStreaming) return
    const text = value.trim() || 'What do you see in this image?'
    onSend(text, pendingImages.length > 0 ? pendingImages : undefined)
    setValue('')
    setPendingImages([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, pendingImages, isStreaming, onSend])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  function removeImage(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="border-t border-border p-3">
      {pendingImages.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingImages.map((img, i) => (
            <div key={img.id} className="group relative">
              <img
                src={img.url}
                alt={img.title ?? `Attached ${i + 1}`}
                className="h-16 w-16 rounded-md border border-border object-cover"
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove image"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => setPickerOpen(true)}
          disabled={isStreaming}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Attach image from library"
          title="Attach image from library"
        >
          <ImagePlus className="h-4 w-4" />
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={
            pendingImages.length > 0
              ? 'Ask about these images...'
              : 'Ask AD anything...'
          }
          disabled={isStreaming}
          rows={1}
          className="flex-1 resize-none rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
        />
        {isStreaming ? (
          <button
            onClick={onAbort}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive text-destructive-foreground transition-colors hover:bg-destructive/90"
            aria-label="Stop generating"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!value.trim() && pendingImages.length === 0}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ImageSourceDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Attach Image"
        images={userImages.images}
        imageUrls={userImages.imageUrls}
        originalUrls={userImages.originalUrls}
        isLoading={userImages.isLoading}
        onSelect={handleSelectImage}
        onUploadToLibrary={handleUploadToLibrary}
      />
    </div>
  )
}
