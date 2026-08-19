'use client'

import { ImageInput } from '../_components/image-input/image-input'
import { LabPage } from '../_components/lab-page/lab-page'
import { ModelSelector } from '../../_components/model-selector/model-selector'
import { OutpaintRunCard } from './_components/outpaint-run-card/outpaint-run-card'
import { MAX_SOURCES, useView } from './use-view'
import styles from './view.module.css'
import {
  ActionButton,
  AspectRatioSelect,
  Button,
  ConfirmDialog,
  CostNote,
  Textarea,
  useConfirm,
} from '#/components'
import { formatCents } from '#/lib/format'

export function View() {
  const v = useView()
  const { confirm, dialogProps } = useConfirm()

  /** Past a threshold the press says how big it is first (#441). Four images
   *  across four models is sixteen generations from a control that looks
   *  exactly like one. */
  async function handleGenerate() {
    if (
      v.needsConfirm &&
      !(await confirm({
        title: `Generate ${v.generationCount} images?`,
        message: `${v.picked.length} image${v.picked.length === 1 ? '' : 's'} through ${v.modelSelector.selectedIds.length} model${v.modelSelector.selectedIds.length === 1 ? '' : 's'}, at about ${formatCents(v.estimatedCost.cents)}.`,
        confirmLabel: 'Generate',
        destructive: false,
      }))
    ) {
      return
    }
    await v.run()
  }

  return (
    <LabPage
      title="Outpaint"
      question="Can a model widen a picture to a different shape without reinterpreting it?"
      instructionFile="src/lib/prompts/outpaint.md"
      error={v.error}
    >
      <ImageInput
        images={v.userImages.images}
        imageUrls={v.userImages.imageUrls}
        isLoading={v.userImages.isLoading}
        picked={v.picked}
        max={MAX_SOURCES}
        onPick={v.addPicked}
        onClear={v.removePicked}
        onOpen={() => void v.userImages.refresh()}
        disabled={v.isRunning}
      />

      {/* Empty is the normal case. What it holds when it is not empty is a
          nudge, not the instruction -- the instruction is the .md named
          above, and typing one here would be the retyping this page exists
          to end. */}
      <Textarea
        value={v.guidance}
        onChange={(e) => v.setGuidance(e.target.value)}
        rows={2}
        placeholder="Optional guidance — e.g. keep the horizon where it is"
        disabled={v.isRunning}
      />

      <div className={styles.actions}>
        <AspectRatioSelect
          orientation={v.orientation}
          aspectRatio={v.aspectRatio}
          onOrientationChange={v.setOrientation}
          onAspectRatioChange={v.setAspectRatio}
          disabled={v.isRunning}
        />
        <ActionButton
          onClick={() => void handleGenerate()}
          loading={v.isRunning}
          loadingText="Sending"
          disabled={!v.canRun}
        >
          {v.generationCount > 1
            ? `Generate ${v.generationCount} images`
            : 'Generate'}
        </ActionButton>
        {v.runs.length > 0 && (
          <Button variant="ghost" onClick={v.clear}>
            Clear runs
          </Button>
        )}
      </div>

      {/* The first thing in the lab that spends real money, so the estimate is
          where it is on Images and Video -- under Generate, before the click
          (#416). */}
      <CostNote
        cents={v.estimatedCost.cents}
        unpriced={v.estimatedCost.unpriced}
      />

      <ConfirmDialog {...dialogProps} />

      <ModelSelector
        mode="multi"
        selectedIds={v.modelSelector.selectedIds}
        visibleModels={v.visibleModels}
        /* One, always -- never `picked.length`. The strip holds the images a
           press iterates over, but each request carries exactly one source, so
           dimming the models that hold fewer than four because four are staged
           would be reporting a limit nothing here is near (#441). */
        stagedImageCount={1}
        onToggleSelected={v.modelSelector.toggleSelected}
        onToggleAll={v.modelSelector.toggleAll}
        onSelectOnly={(id) => v.modelSelector.selectOnly([id])}
        persistKey="genzen:lab:outpaint:model-panel:expanded"
      />

      {v.runs.map((run) => (
        <OutpaintRunCard key={run.key} run={run} />
      ))}
    </LabPage>
  )
}
