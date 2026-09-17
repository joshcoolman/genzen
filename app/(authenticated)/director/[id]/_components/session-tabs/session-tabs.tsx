'use client'

import { KIND_LABEL } from '../../refs'
import { REF_KINDS } from '../../../_lib/types'
import styles from './session-tabs.module.css'
import type { SessionTab } from '../../use-references'
import type { RefKind } from '../../../_lib/types'
import { cx } from '#/lib/utils'

/**
 * The session's tabs, in the heading's end slot (#690).
 *
 * The work area -- the player, the row, the chat panel -- is the first tab and
 * is what a session opens on; Characters and Locations swap the body under the
 * heading and change nothing above it. Same tabs in a chat session and a run
 * session, because a session is the container and the kind of work inside it is
 * not what these are about.
 *
 * They appear only once the session has clips: before that there is nothing to
 * extract from, and a tab whose only answer is "not yet" is a question the page
 * should not be asking.
 */
export function SessionTabs({
  tab,
  onChange,
  counts,
  script,
}: {
  tab: SessionTab
  onChange: (tab: SessionTab) => void
  counts: Record<RefKind, number>
  /** Whether the session has dialogue to show. A run's prompts are typed by
   *  hand and carry no line to find, so it gets no Script tab rather than an
   *  empty one (#690). */
  script: boolean
}) {
  return (
    <nav className={styles.tabs} aria-label="Session">
      <Tab id="work" tab={tab} onChange={onChange} label="Work" />
      {/* Beside Work, because it is the same thing in another form: what the
          run says, read rather than watched. */}
      {script && (
        <Tab id="script" tab={tab} onChange={onChange} label="Script" />
      )}
      {REF_KINDS.map((kind) => (
        <Tab
          key={kind}
          id={kind}
          tab={tab}
          onChange={onChange}
          label={KIND_LABEL[kind]}
          count={counts[kind]}
        />
      ))}
    </nav>
  )
}

function Tab({
  id,
  tab,
  onChange,
  label,
  count,
}: {
  id: SessionTab
  tab: SessionTab
  onChange: (tab: SessionTab) => void
  label: string
  count?: number
}) {
  return (
    <button
      type="button"
      aria-current={tab === id ? 'page' : undefined}
      className={cx(styles.tab, tab === id && styles.tabOn)}
      onClick={() => onChange(id)}
    >
      {label}
      {count ? <span className={styles.count}>{count}</span> : null}
    </button>
  )
}
