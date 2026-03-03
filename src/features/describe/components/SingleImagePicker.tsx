import { useCallback, useEffect, useRef, useState } from 'react'
import { ClipboardPaste, ImageIcon, Upload } from 'lucide-react'
import type { SelectedImage, UserImage } from '../types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ActionButton } from '@/components/ActionButton'
import { ImageCard } from '@/components/ImageCard'
import { ImageGrid } from '@/components/ImageGrid'

type TabId = 'library' | 'upload'

interface SingleImagePickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  images: Array<UserImage>
  imageUrls: Record<string, string>
  isLoading: boolean
  onSelect: (image: SelectedImage) => void
}

export function SingleImagePicker({
  open,
  onOpenChange,
  images,
  imageUrls,
  isLoading,
  onSelect,
}: SingleImagePickerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('library')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pastedPreview, setPastedPreview] = useState<string | null>(null)
  const pastedFileRef = useRef<File | null>(null)

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setPastedPreview(null)
      pastedFileRef.current = null
    }
  }, [open])

  // Paste listener while dialog is open
  useEffect(() => {
    if (!open) return

    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (!item.type.startsWith('image/')) continue
        const file = item.getAsFile()
        if (!file) continue

        event.preventDefault()
        pastedFileRef.current = file
        const url = URL.createObjectURL(file)
        setPastedPreview(url)
        setActiveTab('upload')
        break
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [open])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      pastedFileRef.current = file
      const url = URL.createObjectURL(file)
      setPastedPreview(url)
    },
    [],
  )

  const handleUploadSelect = useCallback(() => {
    if (!pastedPreview || !pastedFileRef.current) return

    const file = pastedFileRef.current
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      onSelect({
        id: `temp-${Date.now()}`,
        url: dataUrl,
        title: file.name,
      })
    }
    reader.readAsDataURL(file)
  }, [pastedPreview, onSelect])

  const handleLibrarySelect = useCallback(
    (image: UserImage) => {
      const url = imageUrls[image.id]
      if (!url) return

      onSelect({
        id: image.id,
        url,
        title: image.title,
      })
    },
    [imageUrls, onSelect],
  )

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'library', label: 'Library' },
    { id: 'upload', label: 'Upload / Paste' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col"
        style={{ width: '66vw', maxWidth: '66vw', maxHeight: '80vh' }}
      >
        <DialogHeader>
          <DialogTitle>Select an Image</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-accent-brand text-black'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {activeTab === 'library' && (
            <>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  Loading images...
                </div>
              ) : images.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  <div className="text-center space-y-2">
                    <ImageIcon className="size-8 mx-auto opacity-50" />
                    <p>No images in your library yet</p>
                  </div>
                </div>
              ) : (
                <ImageGrid size="md">
                  {images.map((image) => (
                    <ImageCard
                      key={image.id}
                      src={imageUrls[image.id] ?? null}
                      alt={image.title}
                      onClick={() => handleLibrarySelect(image)}
                      compact
                    />
                  ))}
                </ImageGrid>
              )}
            </>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4 py-4">
              <div className="flex gap-3">
                <ActionButton
                  icon={<Upload className="size-4" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose File
                </ActionButton>
                <span className="flex items-center text-xs text-muted-foreground">
                  <ClipboardPaste className="size-3 mr-1" />
                  or paste from clipboard
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />

              {pastedPreview && (
                <div className="space-y-3">
                  <div className="max-w-xs">
                    <img
                      src={pastedPreview}
                      alt="Preview"
                      className="rounded-md border border-border max-h-64 object-contain"
                    />
                  </div>
                  <ActionButton onClick={handleUploadSelect}>
                    Use This Image
                  </ActionButton>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
