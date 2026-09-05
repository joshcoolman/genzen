import { useState } from 'react'
import { Tabs } from '@base-ui/react/tabs'
import { loadExports } from '../../_actions/exports.action'
import { Workspace } from '../workspace/workspace'
import { SavedExports } from '../saved-exports/saved-exports'
import styles from './session-content.module.css'
import type { useView } from '../../[id]/use-view'
import type { SavedExport } from '../../_lib/types'

export function SessionContent({
  state,
  initialExports,
}: {
  state: ReturnType<typeof useView>
  initialExports: Array<SavedExport>
}) {
  const [items, setItems] = useState(initialExports)
  const [error, setError] = useState<string | null>(null)
  const opening = state.session.cut.clips.length === 0 && items.length === 0
  async function refresh() {
    try {
      setItems(await loadExports(state.session.id))
      setError(null)
    } catch {
      setError('Exports could not be refreshed. Reload to try again.')
    }
  }
  if (opening)
    return <Workspace state={state} onExportSaved={() => void refresh()} />
  return (
    <Tabs.Root
      defaultValue="session"
      onValueChange={(value) => {
        if (value === 'exports') void refresh()
      }}
    >
      <Tabs.List className={styles.tabs}>
        <Tabs.Tab className={styles.tab} value="session">
          Session
        </Tabs.Tab>
        <Tabs.Tab className={styles.tab} value="exports">
          Exports ({items.length})
        </Tabs.Tab>
      </Tabs.List>
      {error && <p role="alert">{error}</p>}
      <Tabs.Panel value="session">
        <Workspace state={state} onExportSaved={() => void refresh()} />
      </Tabs.Panel>
      <Tabs.Panel value="exports">
        <SavedExports
          sessionId={state.session.id}
          items={items}
          onChange={setItems}
        />
      </Tabs.Panel>
    </Tabs.Root>
  )
}
