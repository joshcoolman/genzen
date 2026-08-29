'use client'

import { Check, ChevronDown } from 'lucide-react'
import { ModelSelector } from '../../_components/model-selector/model-selector'
import { LabPage } from '../_components/lab-page/lab-page'
import { RunCard } from '../_components/run-card/run-card'
import { ENHANCE_TARGETS, useView } from './use-view'
import styles from './view.module.css'
import {
  ActionButton,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Textarea,
} from '#/components'
import { cx } from '#/lib/utils'

export function View() {
  const v = useView()

  return (
    <LabPage
      title="Enhance"
      question="Does this model's own instruction write a better prompt than the shared one?"
      wide
    >
      {/* Inputs to one side, results in the middle — the shape Images has, and
          for the same reason: what you compose with and what you read are
          different jobs, and stacked they mean every run pushes the controls
          off the top of the screen. On the right rather than the left because
          the lab's own nav is already a left rail, and two rails down one edge
          would read as one confused one. */}
      <div className={styles.split}>
        <div className={styles.results}>
          {v.run ? (
            <>
              {/* The prompt that produced these, once rather than on every
                  card. The box is editable and survives a run, so what is in
                  it is not necessarily what these were written from. */}
              <p className={styles.source}>
                <span className={styles.sourceLabel}>From</span> {v.run.prompt}
              </p>
              {/* Also once: the steer is the same for every card, so it is a
                  property of the run and not of any one result. */}
              {v.run.steering && (
                <p className={cx(styles.source, styles.steerEcho)}>
                  <span className={styles.sourceLabel}>Steer</span>{' '}
                  {v.run.steering}
                </p>
              )}

              {v.run.cards.map((card) => (
                <RunCard
                  key={card.modelId}
                  label={card.modelName}
                  note={card.guideFile}
                  output={card.status === 'done' ? card.output : undefined}
                  placeholder={
                    card.status === 'error' ? (
                      <p className={styles.cardError}>
                        {card.error ?? 'Enhance failed'}
                      </p>
                    ) : (
                      <p className={styles.pending}>Enhancing…</p>
                    )
                  }
                />
              ))}
            </>
          ) : (
            <p className={styles.empty}>
              Write an idea, pick the models to compare, and press Enhance. Each
              one is sent the same words and answers in the shape its own
              instruction asks for.
            </p>
          )}
        </div>

        <aside className={styles.inputs}>
          {/* What the idea is being written *for*, above the box you write it
              in: it changes what a good answer even looks like, so choosing it
              after typing reads as an afterthought. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={v.isRunning}
              render={
                <button type="button" className={styles.targetTrigger}>
                  <span>
                    {ENHANCE_TARGETS.find((t) => t.id === v.target)?.label}
                  </span>
                  <ChevronDown className={styles.targetIcon} />
                </button>
              }
            />
            <DropdownMenuContent align="start">
              {ENHANCE_TARGETS.map((t) => (
                <DropdownMenuItem key={t.id} onClick={() => v.setTarget(t.id)}>
                  <Check
                    className={cx(
                      styles.targetCheck,
                      t.id !== v.target && styles.targetCheckHidden,
                    )}
                  />
                  {t.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Textarea
            value={v.prompt}
            onChange={(e) => v.setPrompt(e.target.value)}
            rows={4}
            placeholder="One idea, written any way at all — e.g. a dragon stuck in a grocery store"
            disabled={v.isRunning}
          />

          {/* Below the idea, because it is the standing thing and the idea is
              what changes run to run — and optional, so it must not sit
              between the box you type in and the button you press. */}
          <details className={styles.steering}>
            <summary className={styles.steeringSummary}>
              Steering {v.steering.trim() ? '· on' : '· optional'}
            </summary>
            <Textarea
              value={v.steering}
              onChange={(e) => v.setSteering(e.target.value)}
              rows={6}
              placeholder="How the picture should look — world, medium, palette, mood. Paste one in from anywhere; its own word counts and formatting rules are ignored, only the look is used."
              disabled={v.isRunning}
            />
          </details>

          <div className={styles.actions}>
            <ActionButton
              onClick={() => void v.enhance()}
              loading={v.isRunning}
              loadingText="Enhancing"
              disabled={!v.canRun}
            >
              {!v.isMultiShot && v.modelCount > 1
                ? `Enhance ${v.modelCount} ways`
                : 'Enhance'}
            </ActionButton>
            {v.run && (
              <Button variant="ghost" onClick={v.clear}>
                Clear
              </Button>
            )}
          </div>

          {/* Hidden for a multi-shot run, not disabled: the instruction names
              the video model it writes for, so an image selection is not a
              choice that has been taken away -- it is not part of the question.

              Text only, so no cost note: a press is Claude cents however many
              models are ticked, and the one page that spends real money says so
              under its own button (#441). */}
          {!v.isMultiShot && (
            <ModelSelector
              mode="multi"
              selectedIds={v.modelSelector.selectedIds}
              visibleModels={v.modelSelector.models}
              onToggleSelected={v.modelSelector.toggleSelected}
              onToggleAll={v.modelSelector.toggleAll}
              onSelectOnly={(id) => v.modelSelector.selectOnly([id])}
              persistKey="genzen:lab:enhance:model-panel:expanded"
            />
          )}
        </aside>
      </div>
    </LabPage>
  )
}
