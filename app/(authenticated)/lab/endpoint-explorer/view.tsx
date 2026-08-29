'use client'

import { LabPage } from '../_components/lab-page/lab-page'
import { useView } from './use-view'
import { EndpointReport } from './_components/endpoint-report/endpoint-report'
import styles from './view.module.css'
import { ActionButton, EmptyState, Input } from '#/components'

/**
 * Endpoint Explorer (#523).
 *
 * **It does not generate, and that is the whole design.** Paste a FAL model
 * URL, and the page fetches that endpoint's published OpenAPI document and says
 * whether we could build controls for it. No key, no queue, no spend -- so it
 * can be pointed at anything on fal.ai without thinking about the cost, which
 * is the only way the question gets asked of enough endpoints to answer it.
 *
 * The question: **does one parser hold across real FAL endpoints?** MiniMax's
 * schemas are pristine and publish their own UI hints; mirelo's wrap every
 * optional in `anyOf [T, null]` and publish none. Whether that is a spectrum
 * five control kinds cover, or a long tail with no end, decides whether the
 * real Endpoint Explorer is worth building.
 *
 * The report is not throwaway: it *is* the compatibility check, which is a
 * permanent part of the paste flow whatever gets built on top. This renders it
 * as a page rather than hiding it behind a green dot.
 */
export function View() {
  const { url, setUrl, endpoints, loading, checking, error, check, remove } =
    useView()

  return (
    <LabPage
      title="Endpoint Explorer"
      question="Paste a FAL model URL -- could we build controls for it?"
      error={error}
    >
      <form
        className={styles.paste}
        onSubmit={(e) => {
          e.preventDefault()
          void check()
        }}
      >
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://fal.ai/models/minimax/h3-max/image-to-video"
          aria-label="FAL model URL"
          spellCheck={false}
          className={styles.input}
        />
        <ActionButton type="submit" loading={checking} disabled={!url.trim()}>
          Check
        </ActionButton>
      </form>

      <p className={styles.note}>
        Reads the endpoint&rsquo;s published schema only. Nothing is generated
        and nothing is charged.
      </p>

      {!loading && endpoints.length === 0 && (
        <EmptyState title="No endpoints yet">
          Paste a model URL from fal.ai to see what it would take to draw its
          controls.
        </EmptyState>
      )}

      <div className={styles.list}>
        {endpoints.map((endpoint) => (
          <EndpointReport
            key={endpoint.id}
            endpoint={endpoint}
            onRemove={() => void remove(endpoint.id)}
          />
        ))}
      </div>
    </LabPage>
  )
}
