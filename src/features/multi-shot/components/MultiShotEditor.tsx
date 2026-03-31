import { useState } from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { ShotCard } from './ShotCard'
import type { UserImage } from '@/features/user-images/types'
import type { useMultishotEditor } from '../hooks/use-multishot-editor'
import { Label } from '@/components/ui/label'
import { RefImageStrip } from '@/components/RefImageStrip'
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
import { TwoColumnLayout } from '@/components/TwoColumnLayout'
import { CollapsibleSection } from '@/components/CollapsibleSection'
import { SourceImagePanel } from '@/components/SourceImagePanel'
import { Button } from '@/components/ui/button'
import { useQuickOutpaint } from '@/features/outpaint/hooks/useQuickOutpaint'
import { QuickOutpaintDialog } from '@/features/outpaint/components/QuickOutpaintDialog'

interface MultiShotEditorProps {
  editor: ReturnType<typeof useMultishotEditor>
  userImages: Array<UserImage>
  imageUrls: Record<string, string>
  imagesLoading: boolean
  elementsLocked?: boolean
  children?: React.ReactNode
  onUpload?: (file: File, title: string) => Promise<void>
  isUploading?: boolean
}

export function MultiShotEditor({
  editor,
  userImages,
  imageUrls,
  imagesLoading,
  elementsLocked = false,
  children,
  onUpload,
  isUploading,
}: MultiShotEditorProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState<'element' | 'startImage'>(
    'element',
  )

  const outpaint = useQuickOutpaint({
    sourceImageUrl: editor.settings.startImageUrl,
    expectedAspectRatio: editor.settings.aspectRatio,
  })

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

  const left = (
    <>
      {/* Start Image */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Start Image</h3>
        <SourceImagePanel
          imageUrl={editor.settings.startImageUrl}
          emptyText="Choose Image"
          aspectRatio="video"
          onClick={() => {
            setPickerMode('startImage')
            setPickerOpen(true)
          }}
          onRemove={
            editor.settings.startImageUrl
              ? () =>
                  editor.setSettings({
                    ...editor.settings,
                    startImageUrl: undefined,
                  })
              : undefined
          }
        />
        {outpaint.needsOutpaint && (
          <Button size="sm" variant="outline" onClick={outpaint.openDialog}>
            Outpaint to {editor.settings.aspectRatio}
          </Button>
        )}
        <QuickOutpaintDialog {...outpaint.dialogProps} />
      </div>

      {/* Elements */}
      <CollapsibleSection
        title="Elements"
        storageKey="multishot-elements"
        defaultOpen
      >
        {elementsLocked && editor.elements.length > 0 && (
          <p className="text-xs text-muted-foreground mb-2">
            Elements are locked after generation. Duplicate this sequence to
            modify elements.
          </p>
        )}
        <RefImageStrip
          images={editor.elements.map((el) => ({
            id: el.id,
            url: el.frontalImageUrl,
            title: el.label,
          }))}
          max={6}
          onAdd={() => {
            setPickerMode('element')
            setPickerOpen(true)
          }}
          onRemove={editor.removeElement}
          onImageClick={() => {
            setPickerMode('element')
            setPickerOpen(true)
          }}
          disabled={elementsLocked}
          showLabels
        />
      </CollapsibleSection>

      {/* Settings */}
      <CollapsibleSection title="Settings" storageKey="multishot-settings">
        <div className="space-y-4">
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
      </CollapsibleSection>

      {/* Error */}
      {editor.error && (
        <p className="text-sm text-destructive">{editor.error}</p>
      )}

      {/* Action footer */}
      <div className="flex gap-2">
        <ActionButton
          variant="outline"
          onClick={editor.handleSave}
          className="flex-1"
        >
          Save Draft
        </ActionButton>
        <ActionButton
          onClick={editor.handleGenerate}
          loading={editor.generating}
          loadingText="Generating..."
          icon={<Sparkles className="h-4 w-4" />}
          className="flex-1"
          disabled={!editor.settings.startImageUrl}
        >
          Generate Video
        </ActionButton>
      </div>
    </>
  )

  const right = (
    <>
      <input
        value={editor.name}
        onChange={(e) => editor.setName(e.target.value)}
        className="w-full text-sm font-medium border-none bg-transparent px-0 focus:outline-none"
        placeholder="Sequence name..."
      />

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

      {editor.canAddShot && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={editor.addShot}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  )

  return (
    <>
      <TwoColumnLayout left={left} right={right} fixedHeight={false} />
      {children}

      {/* Image Picker Dialog */}
      <ExistingImagePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        images={userImages}
        imageUrls={imageUrls}
        isLoading={imagesLoading}
        alreadyCollectedIds={alreadyCollectedIds}
        initialSelectedIds={
          pickerMode === 'element' ? alreadyCollectedIds : undefined
        }
        autoConfirm={pickerMode === 'startImage'}
        onConfirm={(selected) => {
          if (pickerMode === 'startImage') {
            const img = selected[0] as (typeof selected)[number] | undefined
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
            const urls = selected
              .map((img) => imageUrls[img.id] ?? img.url)
              .filter(Boolean)
            editor.replaceElements(urls)
          }
          setPickerOpen(false)
        }}
        max={pickerMode === 'startImage' ? 1 : 6}
        onUpload={onUpload}
        isUploading={isUploading}
      />
    </>
  )
}
