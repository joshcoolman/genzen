'use client'

import { ClipPicker } from '../_components/clip-picker/clip-picker'
import { LabPage } from '../_components/lab-page/lab-page'
import { TimelineTrack } from './_components/timeline-track/timeline-track'
import { TrimPanel } from './_components/trim-panel/trim-panel'
import { useView } from './use-view'
import styles from './view.module.css'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { ActionButton, Button, Input } from '#/components'
import { imageUrl } from '#/lib/image-url'

/**
 * A timeline you can actually cut with.
 *
 * No `instructionFile`: nothing here is sent to a model. Sequence and Frames
 * are the other two pages like that.
 *
 * **Export writes a real file.** The preview is a simulation -- clips playing
 * in order, trimmed, in a browser -- and it is labelled as one. What Export
 * produces is a single mp4, encoded by ffmpeg on the server, that lands in the
 * library as an ordinary clip. The distinction matters because the point of
 * this page is the file: a preview that only ever plays clips back to back is
 * the thing this was built instead of.
 */
export function View({ clips }: { clips: Array<VideoRecord> }) {
  const v = useView(clips)

  return (
    <LabPage
      title="Editor"
      question="Can you get to a cut you would keep — in and out points, order, one transition — without leaving the page?"
      error={v.error}
    >
      <div className={styles.stack}>
        {v.selected ? (
          <TrimPanel
            key={v.selected.key}
            track={v.selected}
            onChange={(patch) => v.update(v.selected!.key, patch)}
          />
        ) : (
          <p className={styles.empty}>
            {v.track.length === 0
              ? 'Add a clip to start a timeline. Everything below is the cut, to scale.'
              : 'Select a clip on the timeline to set where it starts and ends.'}
          </p>
        )}

        <TimelineTrack
          track={v.track}
          selectedKey={v.selectedKey}
          onSelect={v.setSelectedKey}
          onRemove={v.remove}
          onMove={v.move}
          onAdd={() => v.setPickerOpen(true)}
        />

        <div className={styles.controls}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Crossfade</span>
            <input
              type="range"
              className={styles.slider}
              min={0}
              max={2}
              step={0.1}
              value={v.transition}
              onChange={(e) => v.setTransition(Number(e.target.value))}
              disabled={v.isExporting}
            />
            <span className={styles.fieldValue}>
              {v.transition === 0 ? 'hard cut' : `${v.transition.toFixed(1)}s`}
            </span>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Name</span>
            <Input
              value={v.title}
              onChange={(e) => v.setTitle(e.target.value)}
              placeholder="Edit"
              disabled={v.isExporting}
            />
          </label>
        </div>

        {/* Said before the encode rather than after it: the server rejects a
            crossfade that does not fit, and finding that out at the end of a
            two-minute export is finding it out too late. */}
        {!v.transitionFits && (
          <p className={styles.warn}>
            A {v.transition.toFixed(1)}s crossfade does not fit — the shortest
            clip on the timeline is {v.shortest.toFixed(2)}s. Shorten the
            transition or trim less.
          </p>
        )}

        <div className={styles.footer}>
          <span className={styles.total}>
            {v.track.length} clip{v.track.length === 1 ? '' : 's'} ·{' '}
            <strong>{v.totalSeconds.toFixed(2)}s</strong> finished
          </span>
          <ActionButton
            onClick={() => void v.run()}
            loading={v.isExporting}
            loadingText="Encoding"
            disabled={!v.canExport}
          >
            Export
          </ActionButton>
          {v.track.length > 0 && (
            <Button variant="ghost" onClick={v.clear} disabled={v.isExporting}>
              Clear
            </Button>
          )}
        </div>

        {v.exported && (
          <div className={styles.result}>
            <video
              className={styles.resultVideo}
              src={imageUrl(v.exported.id)}
              controls
              playsInline
              poster={imageUrl(v.exported.id, 'thumb')}
            />
            <p className={styles.resultNote}>
              <strong>{v.exported.title}</strong> ·{' '}
              {v.exported.durationSeconds.toFixed(2)}s · in your library as an
              ordinary clip, so it can be continued from or put back on a
              timeline.
            </p>
          </div>
        )}
      </div>

      <ClipPicker
        open={v.pickerOpen}
        onOpenChange={v.setPickerOpen}
        clips={v.clips}
        // Nothing is excluded: putting the same shot on the track twice is an
        // ordinary cut, and each copy carries its own in and out points.
        pickedIds={new Set()}
        onConfirm={v.add}
        max={12}
      />
    </LabPage>
  )
}
