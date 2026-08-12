'use client'

import { Clapperboard } from 'lucide-react'
import { formatCost } from '../../models'
import styles from './video-form.module.css'
import type { VideoModel } from '../../models'
import { ActionButton, SingleSelect, Stack, Textarea } from '#/components'

/**
 * Prompt, duration, aspect. Every option is read off the model record rather
 * than hardcoded, so a second entry in `models.ts` needs nothing here.
 */
export function VideoForm({
  model,
  prompt,
  onPromptChange,
  duration,
  onDurationChange,
  aspectRatio,
  onAspectRatioChange,
  estimatedCost,
  isSubmitting,
  canSubmit,
  onSubmit,
}: {
  model: VideoModel
  prompt: string
  onPromptChange: (value: string) => void
  duration: number
  onDurationChange: (value: number) => void
  aspectRatio: string
  onAspectRatioChange: (value: string) => void
  estimatedCost: number
  isSubmitting: boolean
  canSubmit: boolean
  onSubmit: () => void
}) {
  return (
    <Stack gap={12}>
      <Textarea
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        rows={4}
        placeholder="What happens in the shot? Name the camera move and where it ends — a push-in that stops on a medium close-up beats 'the camera moves in'. Dialogue goes in quotes; it is spoken aloud."
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
            onChange={(value) =>
              onAspectRatioChange(value ?? model.aspectRatios[0])
            }
            options={model.aspectRatios.map((ratio) => ({
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
          Generate {formatCost(estimatedCost)}
        </ActionButton>
      </div>
    </Stack>
  )
}
