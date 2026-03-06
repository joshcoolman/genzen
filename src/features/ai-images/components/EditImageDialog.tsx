import { useState } from 'react'
import { Check, ImagePlus, X } from 'lucide-react'
import type { EditorState } from '@/features/ai-images/hooks/use-editor'
import { EDIT_MODELS } from '@/features/ai-images/models'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { AspectRatioSelect } from '@/components/AspectRatioSelect'

interface EditImageDialogProps {
  editor: EditorState
  imageUrls: Record<string, string>
  aiImages: Array<{ id: string }>
  uploadImages: Array<{ id: string }>
}

export function EditImageDialog({
  editor,
  imageUrls,
  aiImages,
  uploadImages,
}: EditImageDialogProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<Array<string>>([])
  const [pickerFilter, setPickerFilter] = useState<'ai' | 'uploads'>('ai')

  const currentModel = EDIT_MODELS.find((m) => m.id === editor.editModelId)
  const multiImageSupported = currentModel?.supportsMultiImage ?? false

  function openPicker() {
    setPendingSelection([...editor.referenceImageIds])
    setPickerOpen(true)
  }

  function togglePendingImage(id: string) {
    setPendingSelection((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 4
          ? prev
          : [...prev, id],
    )
  }

  function confirmSelection() {
    // Sync: remove any that were deselected, add any new
    const toRemove = editor.referenceImageIds.filter(
      (id) => !pendingSelection.includes(id),
    )
    const toAdd = pendingSelection.filter(
      (id) => !editor.referenceImageIds.includes(id),
    )
    toRemove.forEach((id) => editor.removeReferenceImage(id))
    toAdd.forEach((id) => editor.addReferenceImage(id))
    setPickerOpen(false)
  }

  // Filter images based on picker tab, excluding the edit target
  const sourceImages = pickerFilter === 'ai' ? aiImages : uploadImages
  const pickableImages = sourceImages.filter(
    (img) => img.id !== editor.editTarget?.id,
  )

  return (
    <Dialog
      open={editor.editTarget !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPickerOpen(false)
          editor.closeEditor()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>

        {pickerOpen ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPickerFilter('ai')}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    pickerFilter === 'ai'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  AI
                </button>
                <button
                  type="button"
                  onClick={() => setPickerFilter('uploads')}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    pickerFilter === 'uploads'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Uploads
                </button>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                  pendingSelection.length === 0
                    ? 'bg-muted text-muted-foreground'
                    : pendingSelection.length >= 4
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-600 text-white'
                }`}
              >
                {pendingSelection.length}/4
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
              {pickableImages.map((img) => {
                const url = imageUrls[img.id]
                if (!url) return null
                const isSelected = pendingSelection.includes(img.id)
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => togglePendingImage(img.id)}
                    className={`relative aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                      isSelected
                        ? 'border-primary'
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                  >
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="rounded-full bg-primary p-1">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            {pickableImages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No images available
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setPickerOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={confirmSelection} className="flex-1">
                Done ({pendingSelection.length})
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {editor.editTarget && (
              <img
                src={imageUrls[editor.editTarget.id]}
                alt="Editing"
                className="w-full rounded-md object-contain max-h-64 bg-black"
              />
            )}

            {multiImageSupported && (
              <div className="space-y-2">
                {editor.referenceImageIds.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {editor.referenceImageIds.map((id) => {
                      const url = imageUrls[id]
                      if (!url) return null
                      return (
                        <div
                          key={id}
                          className="relative w-14 h-14 rounded-md overflow-hidden border"
                        >
                          <img
                            src={url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => editor.removeReferenceImage(id)}
                            className="absolute -top-1 -right-1 rounded-full bg-destructive p-0.5"
                          >
                            <X className="h-3 w-3 text-destructive-foreground" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openPicker}
                  disabled={editor.editLoading}
                  className="w-full"
                >
                  <ImagePlus className="h-4 w-4 mr-2" />
                  {editor.referenceImageIds.length > 0
                    ? `Reference Images (${editor.referenceImageIds.length}/4)`
                    : 'Add Reference Images'}
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <AspectRatioSelect
                orientation={editor.editOrientation}
                aspectRatio={editor.editAspectRatio}
                onOrientationChange={editor.setEditOrientation}
                onAspectRatioChange={editor.setEditAspectRatio}
                disabled={editor.editLoading}
              />
              <Select
                value={editor.editModelId}
                onValueChange={editor.setEditModelId}
                disabled={editor.editLoading}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDIT_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder={
                multiImageSupported && editor.referenceImageIds.length > 0
                  ? 'Describe the edit. Reference attached images by position: "use the background from the second image..."'
                  : 'Describe the edit — e.g. make the woman smile, change background to sunset...'
              }
              value={editor.editPrompt}
              onChange={(e) => editor.setEditPrompt(e.target.value)}
              disabled={editor.editLoading}
              rows={3}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  void editor.handleEditSubmit()
                }
              }}
            />
            <Button
              onClick={editor.handleEditSubmit}
              disabled={!editor.editPrompt.trim() || editor.editLoading}
              className="w-full"
            >
              {editor.editLoading ? 'Submitting...' : 'Generate Edit'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
