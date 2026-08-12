'use client'

import { Clapperboard } from 'lucide-react'
import { formatCost } from '../../models'
import { PromptList } from '../../../_components/prompt-list/prompt-list'
import styles from './video-form.module.css'
import type { VideoModel } from '../../models'
import { ActionButton, SingleSelect, Stack } from '#/components'

/**
 * Prompts, duration, aspect.
 *
 * The prompt list is the generator panel's, unchanged: one first frame can
 * carry several takes, and each prompt is its own clip. Duration and aspect
 * options are read off the model record rather than hardcoded, so a second
 * entry in `models.ts` needs nothing here.
 */
export function VideoForm({
  model,
  prompts,
  onUpdatePrompt,
  onAddPrompt,
  onRemovePrompt,
  onClearPrompts,
  pendingCount,
  duration,
  onDurationChange,
  aspectRatio,
  aspectOptions,
  onAspectRatioChange,
  estimatedCost,
  isSubmitting,
  canSubmit,
  onSubmit,
}: {
  model: VideoModel
  prompts: Array<string>
  onUpdatePrompt: (index: number, value: string) => void
  onAddPrompt: () => void
  onRemovePrompt: (index: number) => void
  onClearPrompts: () => void
  pendingCount: number
  duration: number
  onDurationChange: (value: number) => void
  aspectRatio: string
  /** Mode-dependent: `auto` exists only when a first frame is set. */
  aspectOptions: Array<string>
  onAspectRatioChange: (value: string) => void
  estimatedCost: number
  isSubmitting: boolean
  canSubmit: boolean
  onSubmit: () => void
}) {
  return (
    <Stack gap={12}>
      <PromptList
        prompts={prompts}
        onUpdatePrompt={onUpdatePrompt}
        onAddPrompt={onAddPrompt}
        onRemovePrompt={onRemovePrompt}
        onClearPrompts={onClearPrompts}
        disabled={isSubmitting}
        placeholders={{
          first:
            'What happens in the shot? Name the camera move and where it ends. Dialogue in quotes is spoken aloud.',
          additional: 'Another take...',
        }}
      />

      <div className={styles.controls}>
        <div className={styles.control}>
          <span className={styles.label}>Duration</span>
          {/* SingleSelect clears on re-click, and a clip with no duration is
              not a request -- so an unset value falls back to the model's. */}
          <SingleSelect
            value={String(duration)}
            onChange={(value) =>
              onDurationChange(Number(value ?? model.defaultDuration))
            }
            options={model.durations.map((seconds) => ({
              value: String(seconds),
              label: `${seconds}s`,
            }))}
          />
        </div>

        <div className={styles.control}>
          <span className={styles.label}>Aspect</span>
          <SingleSelect
            value={aspectRatio}
            onChange={(value) => onAspectRatioChange(value ?? aspectOptions[0])}
            options={aspectOptions.map((ratio) => ({
              value: ratio,
              label: ratio === 'auto' ? 'Match image' : ratio,
            }))}
          />
        </div>
      </div>

      <div className={styles.footer}>
        <p className={styles.note}>
          {model.label} · {model.resolution} · audio included
        </p>
        <ActionButton
          icon={<Clapperboard size={16} />}
          loading={isSubmitting}
          loadingText="Queueing"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {pendingCount > 1 ? `Generate ${pendingCount}` : 'Generate'}{' '}
          {formatCost(estimatedCost)}
        </ActionButton>
      </div>
    </Stack>
  )
}
