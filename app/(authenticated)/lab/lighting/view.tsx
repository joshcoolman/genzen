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
 * **The page is the conversion, in one direction.** A reference goes in, prose
 * comes out, the prose is tested on two fixed subjects, and what you leave with
 * is the text of a `.md` file. Nothing here writes to the repo or the database:
 * capture is a copy, and shipping an effect is a commit.
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
                        <div key={c.key} className={styles.tile}>
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
              <h2 className={styles.title}>Capture</h2>
              <p className={styles.hint}>
                Two edits, and this page makes neither of them. Save the first
                as{' '}
                <code className={styles.file}>
                  src/lib/prompts/lighting/{v.captured.id}.md
                </code>{' '}
                and paste the second into{' '}
                <code className={styles.file}>LIGHTING_EFFECTS</code>.
              </p>
            </header>
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
            <Button variant="ghost" onClick={() => v.setReference([])}>
              Start another
            </Button>
          </section>
        </>
      )}
    </LabPage>
  )
}
