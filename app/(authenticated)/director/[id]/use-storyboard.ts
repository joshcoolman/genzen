'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  closeScene,
  createStoryboard,
  dropTake,
  generateSectionVideo,
  pronounceBoard,
  rerunScene,
  retryFrame,
  setSpokenLine,
} from '../_actions/storyboard.action'
import { RERUN_MODEL_SLUGS, lineToSpeak, scenesToClose } from './board'
import type { RefAsset } from '../_actions/references.action'
import type { BoardScene, StoredBoard } from '../_lib/types'
import { useGenerationPoll } from '#/features/ai-images/hooks/use-generation-poll'
import { useReportError } from '#/components'

/** What a frame is doing, keyed by row id -- what the rows draw and what the
 *  drain reads. */
export type FrameStatus = Record<string, 'pending' | 'completed' | 'failed'>

/**
 * The Storyboard tab (#695).
 *
 * **The frames are props, never state**, on `use-references`' reasoning: they
 * are library rows the page reads, so every change ends in `router.refresh()`
 * and the server hands back what is actually there. The board itself is a
 * prop too -- it is a column on the session row, and the page re-reads it.
 *
 * What this adds over the reference tabs is the **drain**. A closing frame is
 * generated from its scene's opening frame, and a reference is bytes out of the
 * bucket, so nothing can be derived from a row FAL has not answered for yet.
 * Create storyboard submits the openings; this watches them land and asks for
 * each closing in turn -- one at a time and in scene order, because the board
 * is a sequence and filling it from the top is how it is read.
 */
export function useStoryboard(
  sessionId: string,
  board: StoredBoard,
  frames: Record<string, RefAsset>,
) {
  const router = useRouter()
  const report = useReportError()
  const [creating, setCreating] = useState(false)
  /** The scene the re-run dialog is open on, or null. */
  const [rerunning, setRerunning] = useState<BoardScene | null>(null)
  /** The scene the Generate video dialog is open on, or null. */
  const [filming, setFilming] = useState<BoardScene | null>(null)
  /** The take being watched, or null. */
  const [watching, setWatching] = useState<string | null>(null)
  /** Which rows have a section in flight, so two presses are not two takes. */
  const [generating, setGenerating] = useState<Array<string>>([])
  /** Which rows are asking for a failed frame again. */
  const [retrying, setRetrying] = useState<Array<string>>([])
  /** Fix pronunciation is in flight. */
  const [pronouncing, setPronouncing] = useState(false)
  const [words, setWords] = useState('')
  /** What the character says in the take about to be generated. Seeded from
   *  the scene when the dialog opens, so editing it is a change rather than a
   *  retype. */
  const [spoken, setSpoken] = useState('')
  const [model, setModel] = useState<string>(RERUN_MODEL_SLUGS[0])
  const [submitting, setSubmitting] = useState(false)

  const status: FrameStatus = useMemo(
    () =>
      Object.fromEntries(
        Object.values(frames).map((frame) => [frame.id, frame.status]),
      ),
    [frames],
  )

  const pendingSince = useMemo(() => {
    const pending = Object.values(frames)
      .filter((frame) => frame.status === 'pending')
      .map((frame) => frame.created_at)
      .sort()
    return pending[0] ?? null
  }, [frames])
  useGenerationPoll(pendingSince, () => router.refresh())

  const run = useCallback(
    async (work: () => Promise<unknown>) => {
      try {
        await work()
        router.refresh()
        return true
      } catch (cause) {
        /* Through `useReportError`, which opens the key dialog when the reason
           is a missing Anthropic key -- the planner is a Claude call and that
           key is usually empty locally. */
        report(cause, 'That did not work.')
        return false
      }
    },
    [report, router],
  )

  const create = useCallback(async () => {
    if (creating) return
    setCreating(true)
    await run(() => createStoryboard(sessionId))
    setCreating(false)
  }, [creating, run, sessionId])

  /**
   * The drain: one closing frame at a time, as the openings land.
   *
   * Guarded by a ref of scenes already asked for, not by the board alone --
   * the closing id is not on the board until the action returns, and the poll
   * refreshes the page underneath it. Without the guard a scene whose opening
   * settled would be submitted again on the next render, which is a second 8c
   * frame for nothing.
   */
  const asked = useRef(new Set<string>())
  const closing = useRef(false)
  const waiting = useMemo(
    () => scenesToClose(board.scenes, status),
    [board.scenes, status],
  )
  useEffect(() => {
    const next = waiting.find((scene) => !asked.current.has(scene.id))
    if (!next || closing.current) return
    closing.current = true
    asked.current.add(next.id)
    void (async () => {
      const ok = await run(() => closeScene(sessionId, next.id))
      /* A failed submit is forgotten, so the next refresh tries the scene
         again rather than leaving the board a frame short with nothing saying
         why. */
      if (!ok) asked.current.delete(next.id)
      closing.current = false
    })()
  }, [run, sessionId, waiting])

  /**
   * Ask again for one failed frame (#699).
   *
   * **The drain's guard has to forget the scene**, or a retried closing frame
   * that lands would never be followed up -- and a retried *opening* has to be
   * forgotten too, since its closing is about to become derivable again.
   */
  const retry = useCallback(
    async (scene: BoardScene, which: 'opening' | 'closing') => {
      if (retrying.includes(scene.id)) return
      setRetrying((current) => [...current, scene.id])
      const ok = await run(() => retryFrame(sessionId, scene.id, which))
      setRetrying((current) => current.filter((id) => id !== scene.id))
      if (ok) asked.current.delete(scene.id)
    },
    [retrying, run, sessionId],
  )

  const removeTake = useCallback(
    async (scene: BoardScene, takeId: string) => {
      await run(() => dropTake(sessionId, scene.id, takeId))
    },
    [run, sessionId],
  )

  const pronounce = useCallback(async () => {
    if (pronouncing) return
    setPronouncing(true)
    await run(() => pronounceBoard(sessionId))
    setPronouncing(false)
  }, [pronouncing, run, sessionId])

  /** Edit what a scene says, from the row -- the same field the dialog writes,
   *  so a pass down the board before generating anything is the cheap way to
   *  catch a line that would be refused or mispronounced. */
  const editLine = useCallback(
    async (scene: BoardScene, text: string) => {
      await run(() => setSpokenLine(sessionId, scene.id, text))
    },
    [run, sessionId],
  )

  const openRerun = useCallback((scene: BoardScene) => {
    setRerunning(scene)
    setWords('')
  }, [])

  const openFilm = useCallback((scene: BoardScene) => {
    setFilming(scene)
    setWords('')
    setSpoken(lineToSpeak(scene))
  }, [])

  /**
   * Generate the section this row is a spec for.
   *
   * **Guidance is optional here**, unlike a frame re-run: the row already holds
   * everything the request needs, and the words are a note on top of it rather
   * than the whole of what was asked.
   */
  const film = useCallback(async () => {
    if (!filming || generating.includes(filming.id)) return
    const sceneId = filming.id
    setGenerating((current) => [...current, sceneId])
    const ok = await run(() =>
      generateSectionVideo(
        sessionId,
        sceneId,
        words || undefined,
        /* Sent only when it is not what the scene already says, so an
           untouched box writes nothing. */
        spoken.trim() && spoken.trim() !== lineToSpeak(filming)
          ? spoken
          : undefined,
      ),
    )
    setGenerating((current) => current.filter((id) => id !== sceneId))
    if (ok) setFilming(null)
  }, [filming, generating, run, sessionId, spoken, words])

  const rerun = useCallback(async () => {
    if (!rerunning || submitting) return
    setSubmitting(true)
    const ok = await run(() =>
      rerunScene(sessionId, rerunning.id, words, model),
    )
    setSubmitting(false)
    /* The scene is going to be asked for again the moment its new opening
       lands, so the guard has to forget it. */
    if (ok) {
      asked.current.delete(rerunning.id)
      setRerunning(null)
    }
  }, [model, rerunning, run, sessionId, submitting, words])

  /** What the take dialog calls the clip it is playing: the row it came off
   *  and which take it is, which is all there is to say about one. */
  const watchingLabel = useMemo(() => {
    if (!watching) return ''
    for (const scene of board.scenes) {
      const index = scene.videoIds.indexOf(watching)
      if (index !== -1) return `Scene ${scene.number} — Take ${index + 1}`
    }
    return 'Take'
  }, [board.scenes, watching])

  return {
    status,
    creating,
    create,
    pronouncing,
    pronounce,
    filming,
    setFilming,
    openFilm,
    film,
    spoken,
    setSpoken,
    generating,
    retry,
    retrying,
    removeTake,
    editLine,
    watching,
    setWatching,
    watchingLabel,
    rerunning,
    setRerunning,
    words,
    setWords,
    model,
    setModel,
    submitting,
    rerun,
    openRerun,
  }
}
