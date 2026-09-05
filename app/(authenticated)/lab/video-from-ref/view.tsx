'use client'

import { ImageInput } from '../_components/image-input/image-input'
import { LabPage } from '../_components/lab-page/lab-page'
import styles from './view.module.css'
import { DURATIONS, MAX_IMAGES, useView } from './use-view'
import { ActionButton, CostNote, SingleSelect, Textarea } from '#/components'

export function View() {
  const v = useView()

  return (
    <LabPage
      title="Ref Video"
      question="Does naming images as @Image1…@ImageN actually control what ends up in the video?"
      error={v.error}
      wide
    >
      <div className={styles.columns}>
        <div className={styles.results}>
          {v.records.length === 0 ? (
            <p className={styles.empty}>Clips will appear here.</p>
          ) : (
            <div className={styles.clips}>
              {v.records.map((record) => (
                <div key={record.id} className={styles.clip}>
                  {record.status === 'completed' ? (
                    <video
                      className={styles.video}
                      src={`/img/${record.id}`}
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <p className={styles.pending}>
                      {record.status === 'failed'
                        ? (record.generation_error ?? 'Failed')
                        : 'Working…'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.controls}>
          <div className={styles.field}>
            <span className={styles.label}>Reference images</span>
            <ImageInput
              images={v.userImages.images}
              imageUrls={v.userImages.imageUrls}
              isLoading={v.userImages.isLoading}
              picked={v.picked}
              max={MAX_IMAGES}
              onPick={v.addPicked}
              onClear={v.removePicked}
              onOpen={() => void v.userImages.refresh()}
              onRefresh={v.userImages.refresh}
              disabled={v.isSubmitting}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Prompt</span>
            <Textarea
              value={v.prompt}
              onChange={(e) => v.setPrompt(e.target.value)}
              rows={5}
              placeholder="Refer to the images by number — e.g. @Image1 walks into the garage in @Image2 and looks at @Image3"
              disabled={v.isSubmitting}
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Duration</span>
            <SingleSelect
              options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
              value={v.duration}
              onChange={(next) => next && v.setDuration(next)}
            />
          </div>

          <div>
            <ActionButton
              onClick={() => void v.generate()}
              loading={v.isSubmitting}
              loadingText="Queueing"
              disabled={!v.canGenerate}
            >
              Generate
            </ActionButton>
            <CostNote cents={v.estimatedCostCents} />
          </div>
        </div>
      </div>
    </LabPage>
  )
}
