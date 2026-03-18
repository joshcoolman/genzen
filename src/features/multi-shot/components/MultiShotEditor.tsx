import { useState } from 'react'
import { ImageIcon, Plus, Sparkles, X } from 'lucide-react'
import { MAX_TOTAL_DURATION } from '../types'
import { ShotCard } from './ShotCard'
import { ElementCard } from './ElementCard'
import { TimeBudgetBar } from './TimeBudgetBar'
import type { UserImage } from '@/features/user-images/types'
import type { useMultishotEditor } from '../hooks/use-multishot-editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ActionButton } from '@/components/ActionButton'
import { ExistingImagePicker } from '@/features/user-images/components/ExistingImagePicker'

interface MultiShotEditorProps {
  editor: ReturnType<typeof useMultishotEditor>
  userImages: Array<UserImage>
  imageUrls: Record<string, string>
  imagesLoading: boolean
  elementsLocked?: boolean
}

export function MultiShotEditor({
  editor,
  userImages,
  imageUrls,
  imagesLoading,
  elementsLocked = false,
}: MultiShotEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState<'element' | 'startImage'>(
    'element',
  )

  const alreadyCollectedIds = new Set(
    editor.elements
      .map((el) => {
        const match = userImages.find(
          (img) => imageUrls[img.id] === el.frontalImageUrl,
        )
        return match?.id
      })
      .filter((id): id is string => !!id),
  )

  return (
    <div className="space-y-6">
      {/* Name */}
      <Input
        value={editor.name}
        onChange={(e) => editor.setName(e.target.value)}
        className="text-lg font-medium border-none px-0 focus-visible:ring-0"
        placeholder="Sequence name..."
      />

      {/* Start Image */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Start Image</h3>
          {!editor.settings.startImageUrl && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setPickerMode('startImage')
                setPickerOpen(true)
              }}
            >
              <ImageIcon className="h-3 w-3 mr-1" />
              Choose Image
            </Button>
          )}
        </div>
        {editor.settings.startImageUrl ? (
          <div className="relative inline-block">
            <img
              src={editor.settings.startImageUrl}
              alt="Start frame"
              className="h-24 w-auto rounded-md border border-border object-cover"
            />
            <button
              type="button"
              className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive p-0.5 text-destructive-foreground hover:bg-destructive/80"
              onClick={() =>
                editor.setSettings({
                  ...editor.settings,
                  startImageUrl: undefined,
                })
              }
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Required. The first frame of the generated video.
          </p>
        )}
      </div>

      {/* Elements */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Elements</h3>
          {!elementsLocked && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setPickerMode('element')
                setPickerOpen(true)
              }}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Element
            </Button>
          )}
        </div>
        {elementsLocked && editor.elements.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Elements are locked after generation. Duplicate this sequence to
            modify elements.
          </p>
        )}
        {editor.elements.length > 0 ? (
          <div className="flex gap-3 flex-wrap">
            {editor.elements.map((el) => (
              <ElementCard
                key={el.id}
                element={el}
                onRemove={editor.removeElement}
                locked={elementsLocked}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Add character/object images to reference as @Element1, @Element2 in
            shot prompts.
          </p>
        )}
      </div>

      {/* Shots */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Shots</h3>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={!editor.canAddShot}
            onClick={editor.addShot}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Shot
          </Button>
        </div>

        <div className="space-y-2">
          {editor.shots.map((shot, i) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              index={i}
              maxDuration={shot.duration + editor.remainingBudget}
              canDelete={editor.shots.length > 1}
              onUpdate={editor.updateShot}
              onRemove={editor.removeShot}
            />
          ))}
        </div>

        <TimeBudgetBar
          shots={editor.shots}
          totalDuration={editor.totalDuration}
        />
      </div>

      {/* Settings */}
      <div className="space-y-4 rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium">Settings</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Aspect Ratio</Label>
            <Select
              value={editor.settings.aspectRatio}
              onValueChange={(v) =>
                editor.setSettings({
                  ...editor.settings,
                  aspectRatio: v as '16:9' | '9:16' | '1:1',
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="16:9">16:9</SelectItem>
                <SelectItem value="9:16">9:16</SelectItem>
                <SelectItem value="1:1">1:1</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Shot Type</Label>
            <Select
              value={editor.settings.shotType}
              onValueChange={(v) =>
                editor.setSettings({
                  ...editor.settings,
                  shotType: v as 'customize' | 'intelligent',
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customize">Customize</SelectItem>
                <SelectItem value="intelligent">Intelligent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Label className="text-xs">Generate Audio</Label>
          <Switch
            checked={editor.settings.generateAudio}
            onCheckedChange={(checked: boolean) =>
              editor.setSettings({
                ...editor.settings,
                generateAudio: checked,
              })
            }
          />
        </div>
      </div>

      {/* Error */}
      {editor.error && (
        <p className="text-sm text-destructive">{editor.error}</p>
      )}

      {/* Generate */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Est. ${editor.estimatedCost} ({editor.totalDuration}/
          {MAX_TOTAL_DURATION}s)
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={editor.handleSave}>
            Save Draft
          </Button>
          <ActionButton
            onClick={editor.handleGenerate}
            loading={editor.generating}
            loadingText="Generating..."
            icon={<Sparkles className="h-4 w-4" />}
            disabled={editor.shots.length === 0}
          >
            Generate Video
          </ActionButton>
        </div>
      </div>

      {/* Image Picker Dialog */}
      <ExistingImagePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        images={userImages}
        imageUrls={imageUrls}
        isLoading={imagesLoading}
        alreadyCollectedIds={alreadyCollectedIds}
        onConfirm={(selected) => {
          if (pickerMode === 'startImage') {
            const img = selected[0]
            if (img) {
              const url = imageUrls[img.id] ?? img.url
              if (url) {
                editor.setSettings({
                  ...editor.settings,
                  startImageUrl: url,
                })
              }
            }
          } else {
            selected.forEach((img) => {
              const url = imageUrls[img.id] ?? img.url
              if (url) editor.addElement(url)
            })
          }
          setPickerOpen(false)
        }}
        max={pickerMode === 'startImage' ? 1 : 6}
      />
    </div>
  )
}
