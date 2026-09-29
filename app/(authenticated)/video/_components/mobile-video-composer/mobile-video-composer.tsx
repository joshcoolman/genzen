'use client'

import { useState } from 'react'
import { ImagePlus } from 'lucide-react'
import {
  Chip,
  ChipLabel,
  ChipRow,
  ChipStack,
  ComposerBody,
  ComposerHeader,
  ComposerNote,
  ComposerPrompt,
  ComposerRoot,
  DoneFooter,
  NoteAction,
  PrimaryAction,
  Tile,
  TileGrid,
} from '../../../_components/mobile-composer/mobile-composer'
import { ImageInputs } from '../image-inputs/image-inputs'
import { ModelPicker } from '../model-picker/model-picker'
import styles from './mobile-video-composer.module.css'
import type { VideoEndpoint, VideoModel } from '#/features/video/models'
import type { VideoImageInput, VideoImageRole } from '#/features/video/inputs'
import { ConfirmDialog, RatioIcon, Switch, useConfirm } from '#/components'
import { formatCents } from '#/lib/format'

type Step =
  | 'compose'
  | 'model'
  | 'images'
  | 'duration'
  | 'aspect'
  | 'resolution'

const TITLES: Record<Step, string> = {
  compose: 'New clip',
  model: 'Model',
  images: 'Images',
  duration: 'Duration',
  aspect: 'Aspect ratio',
  resolution: 'Resolution',
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

function ratioShape(ratio: string) {
  const [w, h] = ratio.split(':').map(Number)
  return w && h ? { w, h } : null
}

const aspectLabel = (ratio: string) =>
  ratio === 'auto' ? 'Match image' : ratio

interface MobileVideoComposerProps {
  models: Array<VideoModel>
  modelSlug?: string
  onSelectModel: (slug: string) => void
  sources: Array<VideoImageInput & { url: string; title: string }>
  endpoint?: VideoEndpoint
  compatibilityError: string | null
  onAddImages: () => void
  onRemoveImage: (id: string) => void
  onClearImages: () => void
  onImageRoleChange: (id: string, role: VideoImageRole) => void
  prompts: Array<string>
  onUpdatePrompt: (index: number, value: string) => void
  onRemovePrompt: (index: number) => void
  duration: number
  durationOptions: Array<number>
  onDurationChange: (value: number) => void
  aspectRatio: string
  /** Empty means there is no control -- see `VideoForm`. */
  aspectOptions: Array<string>
  onAspectRatioChange: (value: string) => void
  resolution: string
  resolutionOptions: Array<{ id: string }>
  onResolutionChange: (value: string) => void
  supportsAudio: boolean
  generateAudio: boolean
  onGenerateAudioChange: (value: boolean) => void
  estimatedCost: number | null
  needsConfirm: boolean
  pendingCount: number
  promptCount: number
  isSubmitting: boolean
  canSubmit: boolean
  onClose: () => void
  /** Past the confirm: the sheet closes, then this submits. */
  onSubmit: () => void
}

/**
 * Video's composer on a phone (#755) -- `MobileGenerator`'s shape, from the
 * same parts. A prompt, a chip per setting, one Generate with its cost.
 *
 * Model is **single choice here**, unlike Images, so it returns on tap. Audio
 * is a switch on the compose view rather than a step: a step for on/off is a
 * detour. Images is a step because each picture carries a role; with none
 * staged the chip goes straight to the picker. A control that does not exist
 * for the chosen model (aspect on H3's image endpoint, resolution on a
 * one-size model) has no chip, the same rule `VideoForm` keeps.
 *
 * Add prompt is desktop-only; extra prompts that arrive from there are said,
 * not hidden, because Generate runs all of them.
 */
export function MobileVideoComposer(props: MobileVideoComposerProps) {
  const {
    models,
    modelSlug,
    onSelectModel,
    sources,
    endpoint,
    compatibilityError,
    onAddImages,
    onRemoveImage,
    onClearImages,
    onImageRoleChange,
    prompts,
    onUpdatePrompt,
    onRemovePrompt,
    duration,
    durationOptions,
    onDurationChange,
    aspectRatio,
    aspectOptions,
    onAspectRatioChange,
    resolution,
    resolutionOptions,
    onResolutionChange,
    supportsAudio,
    generateAudio,
    onGenerateAudioChange,
    estimatedCost,
    needsConfirm,
    pendingCount,
    promptCount,
    isSubmitting,
    canSubmit,
    onClose,
    onSubmit,
  } = props
  const [step, setStep] = useState<Step>('compose')
  const { confirm, dialogProps } = useConfirm()
  const back = () => setStep('compose')

  const model = models.find((m) => m.slug === modelSlug)
  const extraPrompts = prompts.length - 1
  const shape = ratioShape(aspectRatio)

  /* The same threshold and the same sentence as `VideoForm`: the surprise is
     never the total, it is which factor was larger than you remembered. */
  async function generate() {
    if (needsConfirm) {
      const ok = await confirm({
        title: `Generate ${pendingCount} clips?`,
        message: `${plural(promptCount, 'prompt')}, one clip each, about ${formatCents(estimatedCost ?? 0)}. Cancel to change the model, the duration or the resolution.`,
        confirmLabel: `Generate ${pendingCount}`,
        destructive: false,
      })
      if (!ok) return
    }
    onSubmit()
  }

  return (
    <ComposerRoot>
      <ComposerHeader
        title={TITLES[step]}
        onBack={step === 'compose' ? undefined : back}
        onClose={onClose}
      />

      {step === 'compose' && (
        <ComposerBody>
          <ComposerPrompt
            value={prompts[0] ?? ''}
            onChange={(e) => onUpdatePrompt(0, e.target.value)}
            placeholder={
              supportsAudio && generateAudio
                ? 'What happens in the shot? Dialogue in quotes is spoken aloud.'
                : 'What happens in the shot?'
            }
            disabled={isSubmitting}
          />
          {extraPrompts > 0 && (
            <ComposerNote
              action={
                <NoteAction
                  onClick={() => {
                    for (let i = prompts.length - 1; i > 0; i--)
                      onRemovePrompt(i)
                  }}
                >
                  Remove
                </NoteAction>
              }
            >
              {`+${extraPrompts} more prompt${extraPrompts === 1 ? '' : 's'} will also run.`}
            </ComposerNote>
          )}

          <ChipRow>
            <Chip wide onClick={() => setStep('model')}>
              <ChipLabel>{model?.label ?? 'Model'}</ChipLabel>
            </Chip>
            <Chip
              onClick={() =>
                sources.length > 0 ? setStep('images') : onAddImages()
              }
              aria-label="Images"
            >
              {sources.length > 0 ? (
                <ChipStack
                  urls={sources.map((s) => s.url)}
                  count={sources.length}
                />
              ) : (
                <ImagePlus />
              )}
            </Chip>
            <Chip onClick={() => setStep('duration')} disabled={isSubmitting}>
              {`${duration}s`}
            </Chip>
            {aspectOptions.length > 0 && (
              <Chip onClick={() => setStep('aspect')} disabled={isSubmitting}>
                {shape && <RatioIcon w={shape.w} h={shape.h} />}
                {aspectLabel(aspectRatio)}
              </Chip>
            )}
            {resolutionOptions.length > 0 && (
              <Chip
                onClick={() => setStep('resolution')}
                disabled={isSubmitting}
              >
                {resolution.toLowerCase()}
              </Chip>
            )}
          </ChipRow>

          {supportsAudio && (
            <label className={styles.audio}>
              <span>Audio</span>
              <Switch
                checked={generateAudio}
                onCheckedChange={onGenerateAudioChange}
                disabled={isSubmitting}
              />
            </label>
          )}

          {compatibilityError && (
            <p className={styles.error} role="alert">
              {compatibilityError}
            </p>
          )}

          <PrimaryAction
            onClick={() => void generate()}
            loading={isSubmitting}
            loadingText="Queueing"
            disabled={!canSubmit}
            cost={estimatedCost !== null ? formatCents(estimatedCost) : null}
          >
            {pendingCount > 1 ? `Generate ${pendingCount} clips` : 'Generate'}
          </PrimaryAction>
        </ComposerBody>
      )}

      {step === 'model' && (
        <ComposerBody scroll>
          {/* One model, so a tap is the whole answer -- no Done. */}
          <ModelPicker
            models={models}
            selectedSlug={modelSlug}
            images={sources}
            resolution={resolution}
            generateAudio={generateAudio}
            disabled={isSubmitting}
            onSelect={(slug) => {
              onSelectModel(slug)
              back()
            }}
          />
        </ComposerBody>
      )}

      {step === 'images' && (
        <>
          <ComposerBody scroll>
            <ImageInputs
              images={sources}
              endpoint={endpoint}
              disabled={isSubmitting}
              onAdd={onAddImages}
              onRemove={(id) => {
                onRemoveImage(id)
                if (sources.length === 1) back()
              }}
              onClear={() => {
                onClearImages()
                back()
              }}
              onRoleChange={onImageRoleChange}
              error={compatibilityError}
            />
          </ComposerBody>
          <DoneFooter onClick={back} />
        </>
      )}

      {step === 'duration' && (
        <TileGrid>
          {durationOptions.map((seconds) => (
            <Tile
              key={seconds}
              big
              on={seconds === duration}
              onClick={() => {
                onDurationChange(seconds)
                back()
              }}
            >
              {`${seconds}s`}
            </Tile>
          ))}
        </TileGrid>
      )}

      {step === 'aspect' && (
        <TileGrid>
          {aspectOptions.map((ratio) => {
            const s = ratioShape(ratio)
            return (
              <Tile
                key={ratio}
                on={ratio === aspectRatio}
                onClick={() => {
                  onAspectRatioChange(ratio)
                  back()
                }}
              >
                {s && <RatioIcon w={s.w} h={s.h} />}
                {aspectLabel(ratio)}
              </Tile>
            )
          })}
        </TileGrid>
      )}

      {step === 'resolution' && (
        <TileGrid note="Changes the price.">
          {resolutionOptions.map((r) => (
            <Tile
              key={r.id}
              big
              on={r.id === resolution}
              onClick={() => {
                onResolutionChange(r.id)
                back()
              }}
            >
              {r.id.toLowerCase()}
            </Tile>
          ))}
        </TileGrid>
      )}

      <ConfirmDialog {...dialogProps} />
    </ComposerRoot>
  )
}
