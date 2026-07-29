'use client'

import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Send, Square, X } from 'lucide-react'
import styles from './chat-input.module.css'
import type { ADImage } from '#/features/ad/hooks/useADChat'
import type { ImageSourceResult } from '#/components'
import { ImageSourceDialog } from '#/components'
import { useAuth } from '#/lib/auth'
import { useUserImages } from '#/features/user-images/hooks/useUserImages'
import { cx } from '#/lib/utils'

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
    <div className={styles.root}>
      {pendingImages.length > 0 && (
        <div className={styles.attachments}>
          {pendingImages.map((img, i) => (
            <div key={img.id} className={styles.attachment}>
              <img
                src={img.url}
                alt={img.title ?? `Attached ${i + 1}`}
                className={styles.attachmentImage}
              />
              <button
                onClick={() => removeImage(i)}
                className={styles.attachmentRemove}
                aria-label="Remove image"
              >
                <X className={styles.attachmentRemoveIcon} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className={styles.composer}>
        <button
          onClick={() => setPickerOpen(true)}
          disabled={isStreaming}
          className={cx(styles.square, styles.attach)}
          aria-label="Attach image from library"
          title="Attach image from library"
        >
          <ImagePlus className={styles.attachIcon} />
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
          className={styles.textarea}
        />
        {isStreaming ? (
          <button
            onClick={onAbort}
            className={cx(styles.square, styles.stop)}
            aria-label="Stop generating"
          >
            <Square className={styles.sendIcon} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!value.trim() && pendingImages.length === 0}
            className={cx(styles.square, styles.send)}
            aria-label="Send message"
          >
            <Send className={styles.sendIcon} />
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
