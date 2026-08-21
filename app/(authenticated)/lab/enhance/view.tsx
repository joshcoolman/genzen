'use client'

import { ModelSelector } from '../../_components/model-selector/model-selector'
import { LabPage } from '../_components/lab-page/lab-page'
import { RunCard } from '../_components/run-card/run-card'
import { useView } from './use-view'
import styles from './view.module.css'
import { ActionButton, Button, Textarea } from '#/components'

export function View() {
  const v = useView()

  return (
    <LabPage
      title="Enhance"
      question="Does this model's own instruction write a better prompt than the shared one?"
    >
      <Textarea
        value={v.prompt}
        onChange={(e) => v.setPrompt(e.target.value)}
        rows={4}
        placeholder="One idea, written any way at all — e.g. a dragon stuck in a grocery store"
        disabled={v.isRunning}
      />
      <div className={styles.actions}>
        <ActionButton
          onClick={() => void v.enhance()}
          loading={v.isRunning}
          loadingText="Enhancing"
          disabled={!v.canRun}
        >
          {v.modelCount > 1 ? `Enhance ${v.modelCount} ways` : 'Enhance'}
        </ActionButton>
        {v.run && (
          <Button variant="ghost" onClick={v.clear}>
            Clear
          </Button>
        )}
      </div>

      {/* Text only, so no cost note: a press is Claude cents however many
          models are ticked, and the one page that spends real money says so
          under its own button (#441). */}
      <ModelSelector
        mode="multi"
        selectedIds={v.modelSelector.selectedIds}
        visibleModels={v.modelSelector.models}
        onToggleSelected={v.modelSelector.toggleSelected}
        onToggleAll={v.modelSelector.toggleAll}
        onSelectOnly={(id) => v.modelSelector.selectOnly([id])}
        persistKey="genzen:lab:enhance:model-panel:expanded"
      />

      {v.run && (
        <>
          {/* The prompt that produced these, once rather than on every card.
              The box above is editable and survives a run, so what is in it is
              not necessarily what these were written from. */}
          <p className={styles.source}>
            <span className={styles.sourceLabel}>From</span> {v.run.prompt}
          </p>

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
      )}
    </LabPage>
  )
}
