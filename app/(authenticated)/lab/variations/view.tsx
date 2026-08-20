'use client'

import { ImageInput } from '../_components/image-input/image-input'
import { LabPage } from '../_components/lab-page/lab-page'
import { RunCard } from '../_components/run-card/run-card'
import styles from './view.module.css'
import { COUNTS, MAX_VARIATION_IMAGES, useView } from './use-view'
import {
  ActionButton,
  Button,
  MiniButton,
  SingleSelect,
  Textarea,
} from '#/components'

export function View() {
  const v = useView()

  return (
    <LabPage
      title="Variations"
      question="Does it understand your intent, and are the prompts any good?"
      /* Forked on how many images are in the run (#436), so the page has to
         name the fork that is live rather than a fixed file. */
      instructionFile={v.instructionFile}
      error={v.error}
    >
      <ImageInput
        images={v.userImages.images}
        imageUrls={v.userImages.imageUrls}
        isLoading={v.userImages.isLoading}
        picked={v.picked}
        max={MAX_VARIATION_IMAGES}
        onPick={v.addPicked}
        onClear={v.removePicked}
        onOpen={() => void v.userImages.refresh()}
        disabled={v.isRunning}
      />

      <Textarea
        value={v.guidance}
        onChange={(e) => v.setGuidance(e.target.value)}
        rows={2}
        placeholder="Optional guidance — e.g. a bunch of different camera angles, or combine these and match the illustration style of the one with the clouds"
        disabled={v.isRunning}
      />

      <div className={styles.actions}>
        <SingleSelect
          options={COUNTS.map((n) => ({ value: String(n), label: `${n}` }))}
          value={String(v.count)}
          onChange={(next) => next && v.setCount(Number(next))}
        />
        <ActionButton
          onClick={() => void v.run()}
          loading={v.isRunning}
          loadingText="Writing"
          disabled={!v.canRun}
        >
          Write prompts
        </ActionButton>
        {v.runs.length > 0 && (
          <Button variant="ghost" onClick={v.clear}>
            Clear runs
          </Button>
        )}
      </div>

      {v.runs.map((r) => (
        <RunCard
          key={r.key}
          label={r.title}
          input={r.guidance || undefined}
          outputs={r.prompts}
          /* Fills the Images panel and stops (#433). Nothing runs, nothing is
             spent, and you navigate to Images yourself -- following the
             results from here is cross-route state the lab has no business
             holding. */
          actions={
            <MiniButton
              onClick={() => v.loadInImages(r)}
              disabled={v.loadedKey === r.key}
            >
              {v.loadedKey === r.key ? 'Loaded' : 'Load in Images'}
            </MiniButton>
          }
        />
      ))}
    </LabPage>
  )
}
