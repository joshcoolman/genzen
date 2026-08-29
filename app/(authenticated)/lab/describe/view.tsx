'use client'

import { Check, ChevronDown } from 'lucide-react'
import { ImageInput } from '../_components/image-input/image-input'
import { LabPage } from '../_components/lab-page/lab-page'
import { RunCard } from '../_components/run-card/run-card'
import styles from './view.module.css'
import { useView } from './use-view'
import {
  ActionButton,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components'
import { DESCRIBE_MODES, describeMode } from '#/lib/prompts/describe'
import { cx } from '#/lib/utils'

export function View() {
  const v = useView()

  return (
    <LabPage
      title="Describe"
      question="Is the description accurate without being padded, over-specific, or repeating itself?"
      instructionFile={describeMode(v.mode).file}
      error={v.error}
    >
      <ImageInput
        images={v.userImages.images}
        imageUrls={v.userImages.imageUrls}
        isLoading={v.userImages.isLoading}
        picked={v.picked}
        onPick={v.setPicked}
        onClear={v.clearPicked}
        onOpen={() => void v.userImages.refresh()}
        disabled={v.isRunning}
      />

      <div className={styles.actions}>
        {/* A menu, not the segmented SingleSelect this replaced: the list of
            prompts is meant to grow, and a row of pills stops fitting at
            three or four. The trigger names the prompt currently loaded. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={v.isRunning}
            render={
              <button type="button" className={styles.modeTrigger}>
                <span>{describeMode(v.mode).label}</span>
                <ChevronDown className={styles.modeIcon} />
              </button>
            }
          />
          <DropdownMenuContent align="start">
            {DESCRIBE_MODES.map((m) => (
              <DropdownMenuItem key={m.id} onClick={() => v.setMode(m.id)}>
                <Check
                  className={cx(
                    styles.modeCheck,
                    m.id !== v.mode && styles.modeCheckHidden,
                  )}
                />
                {m.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <ActionButton
          onClick={() => void v.run()}
          loading={v.isRunning}
          loadingText="Describing"
          disabled={!v.canRun}
        >
          Describe
        </ActionButton>
        {v.runs.length > 0 && (
          <Button variant="ghost" onClick={v.clear}>
            Clear runs
          </Button>
        )}
      </div>

      {v.runs.map((r, i) => (
        <RunCard
          key={v.runs.length - i}
          label={`${describeMode(r.mode).label} · ${r.title}`}
          output={r.output}
        />
      ))}
    </LabPage>
  )
}
