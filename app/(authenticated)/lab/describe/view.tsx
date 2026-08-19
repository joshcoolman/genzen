'use client'

import { ImageInput } from '../_components/image-input/image-input'
import { LabPage } from '../_components/lab-page/lab-page'
import { RunCard } from '../_components/run-card/run-card'
import styles from './view.module.css'
import { MODE_FILES, useView } from './use-view'
import type { DescribeMode } from './use-view'
import { ActionButton, Button, SingleSelect } from '#/components'

const MODES: Array<{ value: DescribeMode; label: string }> = [
  { value: 'reconstruct', label: 'Reconstruct' },
  { value: 'anchor', label: 'Anchor' },
]

export function View() {
  const v = useView()

  return (
    <LabPage
      title="Describe"
      question="Is the description accurate without being padded, over-specific, or repeating itself?"
      instructionFile={MODE_FILES[v.mode]}
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
        <SingleSelect
          options={MODES}
          value={v.mode}
          onChange={(next) => next && v.setMode(next)}
        />
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
          label={`${r.mode === 'anchor' ? 'Anchor' : 'Reconstruct'} · ${r.title}`}
          output={r.output}
        />
      ))}
    </LabPage>
  )
}
