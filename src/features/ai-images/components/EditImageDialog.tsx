import { RectangleHorizontal, RectangleVertical } from 'lucide-react'
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

interface EditImageDialogProps {
  editor: EditorState
  imageUrls: Record<string, string>
}

export function EditImageDialog({ editor, imageUrls }: EditImageDialogProps) {
  return (
    <Dialog
      open={editor.editTarget !== null}
      onOpenChange={(open) => {
        if (!open) editor.closeEditor()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {editor.editTarget && (
            <img
              src={imageUrls[editor.editTarget.id]}
              alt="Editing"
              className="w-full rounded-md object-contain max-h-64 bg-black"
            />
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
            placeholder="Describe the edit — e.g. make the woman smile, change background to sunset..."
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
      </DialogContent>
    </Dialog>
  )
}
