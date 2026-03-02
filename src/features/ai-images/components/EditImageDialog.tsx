import { useState } from 'react'
import {
  Check,
  ImagePlus,
  RectangleHorizontal,
  RectangleVertical,
  X,
} from 'lucide-react'
import type { EditorState } from '@/features/ai-images/hooks/use-editor'
import type { SavedAiImage } from '@/features/ai-images/types'
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

interface EditImageDialogProps {
  editor: EditorState
  imageUrls: Record<string, string>
  selectableImages: Array<SavedAiImage>
}

export function EditImageDialog({
  editor,
  imageUrls,
  selectableImages,
}: EditImageDialogProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<Array<string>>([])

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

  // Filter out the edit target from selectable images
  const pickableImages = selectableImages.filter(
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
              <p className="text-sm text-muted-foreground">
                Select up to 4 reference images
              </p>
              <span className="text-xs tabular-nums text-muted-foreground">
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
              <Button
                variant="outline"
                size="icon"
                onClick={editor.handleEditOrientationToggle}
                disabled={editor.editLoading}
                title={`Switch to ${editor.editOrientation === 'landscape' ? 'portrait' : 'landscape'}`}
                className="shrink-0"
              >
                {editor.editOrientation === 'landscape' ? (
                  <RectangleHorizontal className="h-4 w-4" />
                ) : (
                  <RectangleVertical className="h-4 w-4" />
                )}
              </Button>
              <Select
                value={editor.editAspectRatio}
                onValueChange={editor.setEditAspectRatio}
                disabled={editor.editLoading}
              >
                <SelectTrigger className="w-24 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {editor.ratioOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
