import { useCallback, useRef, useState } from 'react'
import { Send, Square, X } from 'lucide-react'
import type { ADImage } from '../hooks/useADChat'

interface ChatInputProps {
  onSend: (text: string, images?: Array<ADImage>) => void
  onAbort: () => void
  isStreaming: boolean
}

function readFileAsBase64(file: File): Promise<ADImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Strip the data:image/xxx;base64, prefix
      const base64 = dataUrl.split(',')[1]
      resolve({ base64, mediaType: file.type })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ChatInput({ onSend, onAbort, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [pendingImages, setPendingImages] = useState<Array<ADImage>>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  async function addImageFile(file: File) {
    if (!file.type.startsWith('image/')) return
    try {
      const img = await readFileAsBase64(file)
      setPendingImages((prev) => [...prev, img])
    } catch (err) {
      console.error('Failed to read image:', err)
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) addImageFile(file)
        return
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    for (const file of e.dataTransfer.files) {
      if (file.type.startsWith('image/')) {
        addImageFile(file)
      }
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function removeImage(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div
      className="border-t border-border p-3"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {pendingImages.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingImages.map((img, i) => (
            <div key={i} className="group relative">
              <img
                src={`data:${img.mediaType};base64,${img.base64}`}
                alt={`Attached ${i + 1}`}
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
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={
            pendingImages.length > 0
              ? 'Ask about these images...'
              : 'Ask AD anything... (paste images here)'
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
    </div>
  )
}
