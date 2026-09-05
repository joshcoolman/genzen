import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { emptyCut } from '../../clips'
import { emptyStoredCut } from '../../_lib/types'
import { SessionContent } from '../session-content/session-content'
import type { useView } from '../../[id]/use-view'

vi.mock('../../_actions/exports.action', () => ({ loadExports: vi.fn() }))
vi.mock('../saved-exports/saved-exports', () => ({ SavedExports: () => null }))

function state(): ReturnType<typeof useView> {
  return {
    session: {
      id: 'session',
      name: 'Story',
      revision: 0,
      cut: emptyStoredCut(),
      draft: '',
      updated_at: '',
    },
    cut: emptyCut(),
    archives: [],
    prompt: '',
    ready: true,
    busy: false,
    error: null,
    status: 'Saved',
    setPrompt: vi.fn(),
    submit: vi.fn(),
    changeSettings: vi.fn(),
    changeImage: vi.fn(),
    forgetPending: vi.fn(),
    checkRequest: vi.fn(),
  }
}
const render = (value: ReturnType<typeof useView>) =>
  renderToStaticMarkup(<SessionContent state={value} initialExports={[]} />)

describe('Director opening workspace', () => {
  it('shows only the opening composer and collapsed settings before the first clip', () => {
    const html = render(state())
    expect(html).toContain('Set the scene')
    expect(html).toContain('Start story')
    expect(html).toContain('Generation settings')
    expect(html).not.toContain('<video')
    expect(html).not.toContain('Sections ·')
    expect(html).not.toContain('Export Final Video')
    expect(html).not.toContain('role="tab"')
    expect(html).not.toContain('role="tabpanel"')
    expect(html).not.toContain('Redo latest')
    expect(html).not.toContain('role="status"')
  })
  it('retains first-request recovery and errors without an empty player', () => {
    const value = state()
    value.cut.pending = {
      id: 'pending',
      prompt: 'Opening scene prompt',
      context: [],
      settings: value.cut.settings,
      redo: false,
      startedAt: 0,
      token: 'receipt',
    }
    value.error = 'Connection interrupted'
    value.status = 'Request retained'
    const html = render(value)
    expect(html).toContain('Check request')
    expect(html).toContain('Dismiss request')
    expect(html).toContain('Connection interrupted')
    expect(html).toContain('Request retained')
    expect(html).not.toContain('<video')
  })
  it('uses saved clips to avoid flashing the opening composer during hydration', () => {
    const value = state()
    value.ready = false
    value.session.cut.clips = [
      {
        id: 'clip',
        prompt: 'First section',
        mediaId: 'video',
        endFrameId: 'frame',
        thumbnailId: 'thumb',
        duration: 5,
        model: 'fixture',
      },
    ]
    const html = render(value)
    expect(html).not.toContain('Set the scene')
    expect(html).toContain('Next direction')
    expect(html).toContain('<video')
    expect(html).toContain('Export Final Video')
    expect(html).toContain('role="tab"')
  })
})
