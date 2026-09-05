'use client'

import { Check, ChevronDown, RotateCw } from 'lucide-react'
import { ImageInput } from '../_components/image-input/image-input'
import { LabPage } from '../_components/lab-page/lab-page'
import styles from './view.module.css'
import { useView } from './use-view'
import { SUBJECT_SLOTS } from './test-subjects'
import { effectFileBody, effectRegistryEntry } from './effect-file'
import {
  ActionButton,
  Button,
  CopyButton,
  CostNote,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
  Input,
  Textarea,
} from '#/components'
import { cx } from '#/lib/utils'

/**
 * Turning a picture you admire into an effect you can reuse (#562).
 *
 * **The page is the conversion, and it finishes the job.** A reference goes in,
 * prose comes out, the prose is tested on two fixed subjects, and Save writes
 * the three files that make it a real effect -- including the candidate you
 * picked, which becomes the tile the Lighting dialog shows. Nothing is live
 * until the diff is committed.
 *
 * **The grid is two columns of two, not four of one.** The columns are the
 * portrait and the object, and the split is the diagnosis -- see
 * `test-subjects.ts`. A column that lands while the other returns flat colour
 * fields is prose that described a photograph instead of a lighting setup,
 * which is exactly the failure #566 shipped and had to undo.
 *
 * **The prose is editable and a tile re-runs alone**, because the loop the
 * issue describes is judge, edit, re-run one -- not derive again from scratch.
 * A derive replaces the grid rather than leaving it: results beside prose that
 * has been replaced is the one way this page could lie about what it tested.
 */
export function View() {
  const v = useView()

  return (
    <LabPage
      title="Lighting"
      question="Does this reference survive being turned into words -- on a face and on an object?"
      instructionFile="src/lib/prompts/lighting/derive.md"
      error={v.error}
      wide
    >
      <section className={styles.section}>
        <header className={styles.head}>
          <h2 className={styles.title}>Reference</h2>
          <p className={styles.hint}>
            The picture whose lighting you want. Input only -- it is never
            shipped and never shown anywhere an effect is applied.
          </p>
        </header>
        <div className={styles.row}>
          <ImageInput
            images={v.userImages.images}
            imageUrls={v.userImages.imageUrls}
            isLoading={v.userImages.isLoading}
            picked={v.reference}
            onPick={v.setReference}
            onClear={v.clearReference}
            onOpen={() => void v.userImages.refresh()}
            onRefresh={v.userImages.refresh}
            disabled={v.isDeriving}
          />
          <ActionButton
            onClick={() => void v.derive()}
            loading={v.isDeriving}
            loadingText="Reading the light"
            disabled={!v.canDerive}
          >
            Derive the setup
          </ActionButton>
        </div>
      </section>

      <section className={styles.section}>
        <header className={styles.head}>
          <h2 className={styles.title}>Test subjects</h2>
          <p className={styles.hint}>
            Pinned, and the same pair under every effect -- that is what makes
            two grids comparable. Two of them, because prose that only works on
            a face is the failure this page exists to catch.
          </p>
        </header>
        <div className={styles.subjects}>
          {SUBJECT_SLOTS.map(({ slot, label, hint }) => {
            const picked = v.subjects[slot]
            return (
              <div key={slot} className={styles.subject}>
                <span className={styles.subjectLabel}>{label}</span>
                <ImageInput
                  images={v.userImages.images}
                  imageUrls={v.userImages.imageUrls}
                  isLoading={v.userImages.isLoading}
                  picked={picked ? [picked] : []}
                  onPick={(next) => v.pinSubject(slot, next.at(0))}
                  onClear={() => v.pinSubject(slot, undefined)}
                  onOpen={() => void v.userImages.refresh()}
                  onRefresh={v.userImages.refresh}
                  disabled={v.isRunning}
                />
                <span className={styles.hint}>{hint}</span>
              </div>
            )
          })}
        </div>
      </section>

      {v.setup && (
        <>
          <section className={styles.section}>
            <header className={styles.head}>
              <h2 className={styles.title}>The setup</h2>
              <p className={styles.hint}>
                Where the sources are, how hard, what stays dark. Nothing in it
                may name anything in the reference, and no sentence may only be
                true of these gels.
              </p>
            </header>
            <Input
              value={v.name}
              onChange={(e) => v.setName(e.target.value)}
              placeholder="Name"
              aria-label="Effect name"
            />
            <Textarea
              value={v.setup}
              onChange={(e) => v.setSetup(e.target.value)}
              rows={14}
              aria-label="Lighting setup"
              className={styles.setup}
            />
            {v.gels.length > 0 && (
              <div className={styles.gels}>
                {v.gels.map((gel) => (
                  <label key={gel.token} className={styles.gel}>
                    <code className={styles.token}>{`{${gel.token}}`}</code>
                    <Input
                      value={gel.color}
                      onChange={(e) => v.setGel(gel.token, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.row}>
              {/* One model, not the dialog's multi-select: the question here is
                  whether the *prose* works, and four tiles through four models
                  answers a different one. Comparing models is what the shipped
                  Lighting dialog is for. */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={v.isRunning}
                  render={
                    <button type="button" className={styles.modelTrigger}>
                      <span>
                        {v.models.find((m) => m.id === v.modelId)?.name ??
                          'Model'}
                      </span>
                      <ChevronDown className={styles.modelIcon} />
                    </button>
                  }
                />
                <DropdownMenuContent align="start">
                  {v.models.map((m) => (
                    <DropdownMenuItem
                      key={m.id}
                      onClick={() => v.setModelId(m.id)}
                    >
                      <Check
                        className={cx(
                          styles.modelCheck,
                          m.id !== v.modelId && styles.modelCheckHidden,
                        )}
                      />
                      {m.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <ActionButton
                onClick={v.runAll}
                loading={v.isRunning}
                loadingText="Rendering"
                disabled={!v.canRun}
              >
                Generate 4 candidates
              </ActionButton>
              <CostNote
                cents={v.estimate.cents}
                unpriced={v.estimate.unpriced}
              />
            </div>
            {!v.subjectsReady && (
              <p className={styles.hint}>
                Pin both test subjects first -- a grid missing the object column
                cannot show the failure it is there for.
              </p>
            )}

            <div className={styles.grid}>
              {SUBJECT_SLOTS.map(({ slot, label }) => (
                <div key={slot} className={styles.column}>
                  <span className={styles.columnLabel}>{label}</span>
                  <div className={styles.tiles}>
                    {v.candidates
                      .filter((c) => c.slot === slot)
                      .map((c) => (
                        <div
                          key={c.key}
                          className={cx(
                            styles.tile,
                            v.chosen === c.key && styles.tileChosen,
                          )}
                        >
                          {/* Clicking a candidate is how the effect gets its
                              thumbnail, so the grid is the picker rather than a
                              separate control listing the same four tiles
                              again. */}
                          <button
                            type="button"
                            className={styles.tileChoose}
                            disabled={!c.url}
                            aria-pressed={v.chosen === c.key}
                            aria-label={`Represent this effect with this ${label.toLowerCase()} candidate`}
                            onClick={() => v.setChosen(c.key)}
                          >
                            {c.url ? (
                              <img
                                src={c.url}
                                alt={`${label} candidate`}
                                className={styles.tileImage}
                              />
                            ) : (
                              <span className={styles.tileNote}>
                                {c.status === 'running'
                                  ? 'Rendering'
                                  : (c.error ?? '')}
                              </span>
                            )}
                          </button>
                          {v.chosen === c.key && (
                            <Check className={styles.tileCheck} />
                          )}
                          {/* Re-running one tile is the whole point of four:
                              the description is fine and the model was noisy,
                              so you want another draw of the same prose. */}
                          <IconButton
                            aria-label="Render this one again"
                            title="Render this one again"
                            className={styles.tileRerun}
                            disabled={!v.canRun || c.status === 'running'}
                            onClick={() => void v.runOne(c.key)}
                          >
                            <RotateCw />
                          </IconButton>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.head}>
              <h2 className={styles.title}>Save</h2>
              <p className={styles.hint}>
                Pick the candidate that represents the effect, then save. It
                writes three files -- the setup, its entry in{' '}
                <code className={styles.file}>LIGHTING_EFFECTS</code>, and the
                picture the Lighting dialog puts on the tile. Nothing is live
                until you commit them.
              </p>
            </header>
            <div className={styles.row}>
              <ActionButton
                onClick={() => void v.save()}
                loading={v.isSaving}
                loadingText="Writing"
                disabled={!v.canSave}
              >
                Save effect
              </ActionButton>
              {!v.chosen && (
                <span className={styles.hint}>
                  Click a candidate above to choose the thumbnail.
                </span>
              )}
              <Button variant="ghost" onClick={v.reset}>
                Start another
              </Button>
            </div>

            {v.saved && (
              <ul className={styles.saved}>
                {v.saved.files.map((file) => (
                  <li key={file}>
                    <code className={styles.file}>{file}</code>
                  </li>
                ))}
              </ul>
            )}

            {/* Kept beside the button rather than replaced by it: Save writes
                into the repo and so only runs under `pnpm dev`, and the two
                edits are small enough to make by hand when it cannot. */}
            <details className={styles.byHand}>
              <summary className={styles.hint}>
                Or make the edits by hand
              </summary>
              <div className={styles.capture}>
                <pre className={styles.code}>{effectFileBody(v.captured)}</pre>
                <CopyButton text={effectFileBody(v.captured)} />
              </div>
              <div className={styles.capture}>
                <pre className={styles.code}>
                  {effectRegistryEntry(v.captured)}
                </pre>
                <CopyButton text={effectRegistryEntry(v.captured)} />
              </div>
            </details>
          </section>
        </>
      )}
    </LabPage>
  )
}
