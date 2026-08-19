'use client'

import { LabPage } from '../_components/lab-page/lab-page'
import { RunCard } from '../_components/run-card/run-card'
import { useView } from './use-view'
import styles from './view.module.css'
import { ActionButton, Button, Textarea } from '#/components'

export function View() {
  const { prompt, setPrompt, runs, isRunning, error, canRun, run, clear } =
    useView()

  return (
    <LabPage
      title="Enhance"
      question="Is the output too verbose, and did it keep what you meant?"
      instructionFile="src/lib/prompts/enhance-prompt.md"
      error={error}
    >
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder="A vague prompt worth enhancing — e.g. a cat sitting at the counter in a coffee shop, photorealistic"
        disabled={isRunning}
      />
      <div className={styles.actions}>
        <ActionButton
          onClick={() => void run()}
          loading={isRunning}
          loadingText="Enhancing"
          disabled={!canRun}
        >
          Enhance
        </ActionButton>
        {runs.length > 0 && (
          <Button variant="ghost" onClick={clear}>
            Clear runs
          </Button>
        )}
      </div>

      {runs.map((r, i) => (
        <RunCard
          // Runs are append-only and never reordered, so the index is stable
          // for as long as the list lives.
          key={runs.length - i}
          label={`Run ${runs.length - i}`}
          input={r.input}
          output={r.output}
        />
      ))}
    </LabPage>
  )
}
