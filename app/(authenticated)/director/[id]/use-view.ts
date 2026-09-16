'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateVideo } from '../../video/_actions/generate-video.action'
import { askCharacter } from '../_actions/chat.action'
import { trashClip, writeRun } from '../_actions/sessions.action'
import {
  GEN_MODEL_SLUG,
  MAX_REFS,
  REF_MODEL_SLUG,
  clampRatio,
  genModel,
  genModelFor,
  genRatiosFor,
  nearestGenRatio,
  nearestRatio,
} from './gen'
import {
  isPending,
  isReady,
  playableClips,
  toPlayableIndex,
  toRowIndex,
} from './run'
import { scriptOf } from './script'
import type { Ready } from './run'
import type { GenFrame } from './_components/gen-form/gen-form'
import type { ChatTurn, Session } from '../_lib/types'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { aspectRatio } from '#/features/video/clip-facts'
import { captureLastFrame } from '#/features/video/frame-capture'
import { findClipEndFrame } from '#/features/video/server/find-clip-end-frame.action'
import { stampFrameSource } from '#/features/video/server/stamp-frame.action'
import { useGenerationPoll } from '#/features/ai-images/hooks/use-generation-poll'
import { saveFileToLibrary } from '#/features/user-images/lib/save-to-library'
import { updateImageMeta } from '#/features/user-images/server/images.action'
import { useAuth } from '#/lib/auth'
import { imageUrl } from '#/lib/image-url'
import { toast, useReportError } from '#/components'

/**
 * A run of clips, in the order they should be watched.
 *
 * **The order is the entire state.** There is no timeline model here -- no
 * global clock, no per-clip offsets, no trims. A sequence is an array, and
 * rearranging it is `move`. Everything a real editor would add (a time ruler,
 * a scrubber that spans clips, proportional widths) needs a global timeline,
 * and a global timeline is what turns this into an editor rather than a way to
 * answer "do these cut together?" (#497).
 *
 * **The run is the session, and only the run** (#662). Its clip ids are in
 * `director_sessions.cut`; everything else about a clip is read off the library
 * row as it is now. This replaced a single `localStorage` record when Sequence
 * became Director's workspace -- the arrangement now has a name and survives
 * the machine it was made on, which is the whole difference between a lab page
 * and a session.
 */
export function useView(session: Session, clips: Array<VideoRecord>) {
  const router = useRouter()
  const { user } = useAuth()

  /**
   * The stored run, against the library as it is now.
   *
   * In the initialiser rather than an effect, which is the opposite of what the
   * lab page did and for the reason that made it necessary there: the ids came
   * out of `localStorage`, which the server render has no access to, so a run
   * that appeared only after hydration was a mismatch. These come from the row
   * the page already fetched, so both renders agree.
   *
   * Ids that no longer resolve are dropped rather than held: a clip trashed
   * from Video is gone, and a run cannot show it. The pruned run is written
   * back by the persist effect below.
   */
  const [picked, setPicked] = useState<Array<VideoRecord>>(() => {
    const byId = new Map(clips.map((c) => [c.id, c]))
    return session.cut.clipIds
      .map((id) => byId.get(id))
      .filter((c): c is VideoRecord => c !== undefined)
  })

  /**
   * Save the run whenever it changes, one write at a time.
   *
   * **Serialised on a promise rather than fired in parallel**: every write
   * checks the revision it was read at and bumps it, so two in flight at once
   * means the second is rejected as a stale tab -- which is true of another tab
   * and false of two clicks in a row. The chain keeps them in order and carries
   * the new revision forward.
   *
   * A failed write leaves the run on screen and says so. It is not rolled back:
   * the arrangement in front of you is the one you made, and the honest repair
   * is a reload rather than the page silently rearranging itself.
   */
  const revision = useRef(session.revision)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const saved = useRef(session.cut.clipIds.join(','))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ids = picked.map((c) => c.id)
    const key = ids.join(',')
    if (key === saved.current) return
    saved.current = key
    queue.current = queue.current.then(async () => {
      try {
        revision.current = (
          await writeRun(session.id, revision.current, ids)
        ).revision
        setError(null)
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'The run could not be saved.',
        )
      }
    })
  }, [picked, session.id])

  /**
   * Take the run's rows from the server's, whenever the server's change (#660).
   *
   * The page's bargain is that a clip is read off the library row *as it is
   * now* -- and once a clip can be born here, that has to keep happening rather
   * than only at load. A generated clip enters the run as a placeholder the
   * moment it is submitted, and the row behind it is `pending` until the poll
   * settles it; this is what turns that placeholder into a real clip with a
   * poster, in place, without the run being rebuilt around it.
   *
   * **Ids missing from `clips` are kept, not dropped.** That is the opposite of
   * what the initialiser does, and deliberately: at load an unknown id is a clip
   * that was trashed, while here it is most likely a clip submitted a second
   * ago whose row this render has not fetched yet. Dropping it would delete the
   * thing that was just asked for.
   */
  useEffect(() => {
    if (clips.length === 0) return
    const byId = new Map(clips.map((c) => [c.id, c]))
    setPicked((current) => {
      const next = current.map((clip) => byId.get(clip.id) ?? clip)
      // Same rows, same order: hand back the array we were given, so a refresh
      // that changed nothing in the run is not a re-render of it.
      return next.some((clip, index) => clip !== current[index])
        ? next
        : current
    })
  }, [clips])

  /**
   * The oldest clip in the run still being made, or null.
   *
   * A timestamp rather than a count because it is what `useGenerationPoll`
   * backs off against, and reading it off the *run* rather than the library
   * matters: a clip generated on another route is none of this page's business
   * and must not keep a timer alive here.
   */
  const pendingSince = useMemo(() => {
    const times = picked
      .filter((c) => c.status === 'pending')
      .map((c) => c.created_at)
      .sort()
    return times[0] ?? null
  }, [picked])

  useGenerationPoll(pendingSince, () => router.refresh())
  /* The run's prompts, verbatim, as they stand. Nothing is stored and nothing
     is sent to a model -- see `script.ts`. */
  const [scriptOpen, setScriptOpen] = useState(false)
  const script = useMemo(() => scriptOf(picked), [picked])
  /**
   * Which clip the player is on, so the row can mark it (#512).
   *
   * Lifted here rather than read out of the player, because the player is the
   * only thing that knows -- it moves at `ended`, at a skip, and when the run
   * shrinks under it -- and the row is its sibling, not its child. Null while
   * the run is empty, which is the state where no tile should be lit.
   */
  const [playingIndex, setPlayingIndex] = useState<number | null>(null)

  /**
   * Drop a clip from the run, and trash it (#679).
   *
   * A Director-born clip lives and dies with its session: nothing else shows
   * it, so a clip that left the run would otherwise be a row nobody can reach.
   * Trash can restore it, which is the safety a confirm dialog would have
   * bought at the cost of a click on every remove. The row leaves the run at
   * once; the trash follows and is guarded server-side on origin.
   */
  const removeClip = useCallback((id: string) => {
    setPicked((current) => current.filter((c) => c.id !== id))
    trashClip(id).catch(() => toast.error('The clip could not be trashed'))
  }, [])

  /** The clip the pencil was pressed on, or null (#657, #660). */
  const [editing, setEditing] = useState<VideoRecord | null>(null)

  /**
   * Name a clip, on the clip's own row.
   *
   * **This is the one thing on the page that outlives the page.** A run is not
   * stored -- that bargain holds -- but a name is a fact about a clip, so it
   * goes where every other surface will read it: `user_images.title`, through
   * the action Images already renames stills with. Nothing lab-shaped is being
   * persisted, which is what keeps this on the right side of the rule.
   *
   * Written through optimistically and rolled back on failure. The run is a
   * local copy of rows, so the server's answer is not what the row is read
   * from -- and a name that appears, then vanishes, is a clearer failure than
   * one that takes a round trip to show up while you are typing the next one.
   */
  const renameClip = useCallback(async (clip: VideoRecord, title: string) => {
    const apply = (value: string) =>
      setPicked((current) =>
        current.map((c) => (c.id === clip.id ? { ...c, title: value } : c)),
      )
    apply(title)
    setEditing(null)
    try {
      // `description` is passed back as it stands: the action writes both
      // columns, so omitting it would clear the clip's prompt.
      await updateImageMeta(clip.id, title, clip.description)
    } catch {
      apply(clip.title)
    }
  }, [])

  /** Lift one clip out and drop it in at `to`, everything else closing up. */
  const move = useCallback((from: number, to: number) => {
    setPicked((current) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= current.length ||
        to >= current.length
      ) {
        return current
      }
      const next = [...current]
      const [lifted] = next.splice(from, 1)
      next.splice(to, 0, lifted)
      return next
    })
  }, [])

  /* ---------------------------------------------------------------- chat
     A session started as a chat (#670): the same run, answered a turn at a
     time by a character the model invents on the first question. */

  const [chat, setChat] = useState(session.chat)
  /** The conversation as text, for the dialog: a question, its answer, a
   *  blank line. The character is left out on purpose -- see `ChatPanel`. */
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  /** Whether a chat's run rejoins clip 1 after the last. Off: an answer is
   *  said once, like a person says it. */
  const [loop, setLoop] = useState(false)
  const transcript = useMemo(
    () =>
      (chat?.turns ?? [])
        .map((turn) => `${turn.question}\n\n${turn.line}`)
        .join('\n\n---\n\n'),
    [chat],
  )
  const reportError = useReportError()

  /**
   * Which turns are still being answered: those with a clip the library has
   * not settled. Read off the run's rows rather than kept as state, so the poll
   * that finishes a clip is what finishes the answer.
   */
  const answering = useMemo(() => {
    const done = new Set(
      picked.filter((c) => c.status === 'completed').map((c) => c.id),
    )
    return new Set(
      (chat?.turns ?? [])
        .filter((turn) => turn.clipIds.some((id) => !done.has(id)))
        .map((turn) => turn.id),
    )
  }, [chat, picked])

  /**
   * What the player may hold. A run: every finished clip. A chat: a clip once
   * it *and every clip before it in its answer* have finished -- the prefix
   * rule. The bursts are submitted together and land in any order, and the
   * stage plays them in order as they arrive: clip 3 landing before clip 2
   * waits for it, so an answer is never heard out of sequence. The player
   * itself handles running out of ready clips mid-answer (see `starved`
   * there).
   */
  const ready = useMemo<Ready>(() => {
    if (!chat) return isReady
    const done = new Set(
      picked.filter((c) => c.status === 'completed').map((c) => c.id),
    )
    const held = new Set<string>()
    for (const turn of chat.turns) {
      let blocked = false
      for (const id of turn.clipIds) {
        if (!done.has(id)) blocked = true
        if (blocked) held.add(id)
      }
    }
    return (clip) => isReady(clip) && !held.has(clip.id)
  }, [chat, picked])

  /**
   * The answer that just started arriving, as the row index of its first
   * clip, so the view can play it from the top. Fires once per turn, when
   * the first clip is ready: the ids already answered when the page opened
   * are seeded, so a restored chat does not replay its last answer on load.
   */
  const played = useRef<Set<string> | null>(null)
  const [answerReady, setAnswerReady] = useState<{
    turnId: string
    rowIndex: number
  } | null>(null)
  useEffect(() => {
    if (!chat) return
    if (played.current === null) {
      played.current = new Set(
        chat.turns.filter((t) => !answering.has(t.id)).map((t) => t.id),
      )
      return
    }
    for (const turn of chat.turns) {
      if (played.current.has(turn.id)) continue
      const first = picked.find((c) => c.id === turn.clipIds[0])
      if (!first || !ready(first)) continue
      played.current.add(turn.id)
      const rowIndex = picked.indexOf(first)
      setAnswerReady({ turnId: turn.id, rowIndex })
    }
  }, [chat, answering, picked, ready])

  /**
   * Ask, and put the answer's clips in the run before they exist -- the same
   * bargain Add gen makes. The server records the turn with its clip ids, so
   * what comes back is the session as written: its revision replaces the one
   * this tab holds and its ids are what the persist effect would otherwise try
   * to write again.
   *
   * **Questions queue; the box never locks.** The model takes ten seconds a
   * turn and you may have three questions in your head, so `ask` only
   * appends, and a drain below sends them one at a time in order -- one at a
   * time because each turn reads the transcript the last one wrote, and in
   * order because the run is the conversation. A question that fails is
   * reported and dropped, and the next one goes.
   */
  const [questions, setQuestions] = useState<
    Array<{ question: string; steer?: string }>
  >([])
  /** The question with the model right now, or null. */
  const [inFlight, setInFlight] = useState<string | null>(null)
  const draining = useRef(false)

  const ask = useCallback(
    (question: string, steer?: string) => {
      if (!chat) return
      setQuestions((current) => [...current, { question, steer }])
    },
    [chat],
  )

  useEffect(() => {
    if (draining.current || questions.length === 0) return
    const { question, steer } = questions[0]
    draining.current = true
    setInFlight(question)
    void (async () => {
      try {
        const updated = await askCharacter(session.id, question, steer)
        const turn: ChatTurn | undefined = updated.chat?.turns.at(-1)
        revision.current = updated.revision
        saved.current = updated.cut.clipIds.join(',')
        setChat(updated.chat)
        if (turn) {
          const placeholders: Array<VideoRecord> = turn.clipIds.map((id) => ({
            id,
            title: genModel().label,
            description: '',
            status: 'pending',
            generation_error: null,
            created_at: new Date().toISOString(),
            group_id: null,
            generation_metadata: {},
            width: null,
            height: null,
            hidden_at: null,
            has_end_frame: false,
          }))
          setPicked((current) => {
            const have = new Set(current.map((c) => c.id))
            return [...current, ...placeholders.filter((p) => !have.has(p.id))]
          })
        }
        router.refresh()
      } catch (err) {
        // A missing Anthropic key opens the key dialog; anything else toasts.
        reportError(err, 'The character could not answer.')
      } finally {
        draining.current = false
        setInFlight(null)
        setQuestions((current) => current.slice(1))
      }
    })()
  }, [questions, session.id, router, reportError])

  /* The row shows a clip being made and the player cannot, so the two are
     indexed apart. `run.ts` owns both directions; see there. */
  const playable = useMemo(() => playableClips(picked, ready), [picked, ready])

  const playableIndexOf = useCallback(
    (rowIndex: number) => toPlayableIndex(picked, rowIndex, ready),
    [picked, ready],
  )

  const rowIndexOf = useCallback(
    (playableIndex: number | null) => toRowIndex(picked, playableIndex, ready),
    [picked, ready],
  )

  /* The shape of the run: the first *finished* clip's, since a clip still being
     made has no pixels to measure yet. */
  const runRatio = playable.length > 0 ? aspectRatio(playable[0]) : null

  /* ---------------------------------------------------------------- generate
     Making the next clip from inside the run (#660). */

  const model = genModel()

  /** Which clip a generation is for: appended to the end, or in place of one. */
  const [target, setTarget] = useState<
    { kind: 'append' } | { kind: 'replace'; index: number } | null
  >(null)
  const [genOpen, setGenOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(model.defaultDuration)
  const [ratio, setRatio] = useState(nearestGenRatio(null))
  const [frame, setFrame] = useState<GenFrame | null>(null)
  const [frameLoading, setFrameLoading] = useState(false)
  const [frameError, setFrameError] = useState<string | null>(null)
  /** The frame a replacement has to end on, when the run continues past it. */
  const [endFrame, setEndFrame] = useState<GenFrame | null>(null)
  const [endFrameLoading, setEndFrameLoading] = useState(false)
  /**
   * Frames pulled out of earlier clips, so the prompt can name what left the
   * shot (#665). Empty on every open: a reference is about this request, not
   * about the run, and carrying the last one forward would spend Kling money on
   * a continuation that did not ask for it.
   */
  const [refs, setRefs] = useState<Array<GenFrame>>([])
  const [busy, setBusy] = useState(false)

  /** Appended, skipping anything already on the strip and stopping at the cap
   *  the model takes. */
  const addRefs = useCallback((chosen: Array<GenFrame>) => {
    setRefs((current) => {
      const have = new Set(current.map((r) => r.id))
      return [...current, ...chosen.filter((r) => !have.has(r.id))].slice(
        0,
        MAX_REFS,
      )
    })
  }, [])

  const dropRef = useCallback((id: string) => {
    setRefs((current) => current.filter((r) => r.id !== id))
  }, [])

  /**
   * The library row holding a clip's last frame, made if it does not exist.
   *
   * Lifted from Video's Continue (`video/use-view.ts`), including the reason
   * for the first line: pressing it twice on one clip used to write the same
   * picture to the library twice, two rows indistinguishable except by id
   * (#542). Asking provenance first costs one query and skips a 20-30MB
   * download, a decode and an upload whenever it hits -- which here is every
   * regenerate after the first, and every re-open of the dialog.
   */
  const resolveEndFrame = useCallback(
    async (clip: VideoRecord): Promise<GenFrame> => {
      const existing = await findClipEndFrame({ clipId: clip.id })
      if (existing) {
        return {
          id: existing.id,
          url: imageUrl(existing.id, 'thumb'),
          title: existing.title ?? `Frame \u00b7 ${clip.title}`,
        }
      }

      const { blob, timeSeconds } = await captureLastFrame(`/img/${clip.id}`)
      const image = await saveFileToLibrary({
        userId: user.id,
        file: new File([blob], `frame-${clip.id}-end.png`, {
          type: 'image/png',
        }),
        title: `Frame \u00b7 ${clip.title}`,
        description: clip.description,
      })

      // Best effort, exactly as Continue has it: a frame whose origin failed to
      // stamp is still a usable first frame, and the only cost is that the next
      // press extracts it again instead of finding this row.
      void stampFrameSource({
        imageId: image.id,
        clipId: clip.id,
        timeSeconds,
        kind: 'end',
      }).catch(() => {})

      return {
        id: image.id,
        url: imageUrl(image.id, 'thumb'),
        title: image.title,
      }
    },
    [user.id],
  )

  /** Read a clip's ending into the frame slot, with the dialog already open. */
  const loadFrameFrom = useCallback(
    async (clip: VideoRecord) => {
      setFrameLoading(true)
      setFrameError(null)
      try {
        setFrame(await resolveEndFrame(clip))
      } catch (err) {
        // Not fatal, and not a toast: the dialog is open and the form still
        // works without a frame. Saying so in place is the difference between
        // "this went wrong" and "you are about to generate a hard cut".
        setFrame(null)
        setFrameError(
          err instanceof Error && err.message
            ? `${err.message} -- this will start from nothing.`
            : 'Could not read the last frame -- this will start from nothing.',
        )
      } finally {
        setFrameLoading(false)
      }
    },
    [resolveEndFrame],
  )

  /**
   * A clip's length as a pill the form can show, or the model's default.
   *
   * Read off `generation_metadata`, which is where every clip made here or on
   * Video records it. An upload has none; a clip made elsewhere at a length the
   * pills do not offer falls back rather than putting a value on the form it
   * cannot draw.
   */
  const durationOf = useCallback(
    (clip: VideoRecord | undefined) => {
      const seconds = clip?.generation_metadata?.duration_seconds
      return typeof seconds === 'number' && model.durations.includes(seconds)
        ? seconds
        : model.defaultDuration
    },
    [model.durations, model.defaultDuration],
  )

  /**
   * Add gen: make the clip that comes after the run.
   *
   * **The frame comes from the last clip, whatever it is.** That is the whole
   * assumption the button rests on -- appending to a run means carrying on from
   * where it ended -- and it holds without knowing anything else about the clip
   * before it. An empty run has nothing to carry on from, which is the one case
   * that starts as text-to-video and shows the ratio pills.
   *
   * **And so do the prompt and the duration** (#662). It opens on the previous
   * clip's text, to be edited down to the new action rather than retyped --
   * which is the method that was already being used by hand, with a copy and a
   * paste in the middle of it -- and on the previous clip's length, since a run
   * cut in eights wants another eight and the model's default was reset to
   * every time. Regenerate has always refilled its form from the clip; this
   * was the one door that opened blank.
   *
   * The frame carries the look, so what the text is really carrying is
   * everything a picture cannot hold: motion, pace, camera, and whatever was
   * said about sound -- a clause about music written into the first clip
   * propagates through a run for free, as long as editing the action does not
   * quietly trim it.
   */
  const openAdd = useCallback(() => {
    const last = picked.at(-1)
    setTarget({ kind: 'append' })
    setPrompt(last?.description ?? '')
    setDuration(durationOf(last))
    setRatio(nearestGenRatio(runRatio))
    setFrame(null)
    setFrameError(null)
    setRefs([])
    // Appending has no join after it, so there is never an ending to pin.
    setEndFrame(null)
    setEndFrameLoading(false)
    setGenOpen(true)
    // A clip still being made has no last frame to read, so appending after one
    // starts from nothing rather than waiting on it.
    if (last && last.status === 'completed') void loadFrameFrom(last)
  }, [picked, runRatio, durationOf, loadFrameFrom])

  /**
   * Regenerate: make another clip for a position the run already has.
   *
   * Nothing new is stored to make this possible -- `generation_metadata`
   * already carries the request that made the clip, so the form is refilled
   * from the row itself. A clip with no metadata is an upload, and the tab that
   * opens this is not shown on one.
   */
  const openEdit = useCallback(
    (clip: VideoRecord) => {
      setEditing(clip)
      const index = picked.findIndex((c) => c.id === clip.id)
      if (index < 0) return
      const meta = clip.generation_metadata ?? {}
      const sourceId = meta.source_image_id

      setTarget({ kind: 'replace', index })
      setPrompt(clip.description ?? '')
      setDuration(durationOf(clip))
      setRatio(nearestGenRatio(aspectRatio(clip)))
      setFrameError(null)
      setRefs([])

      /* The frame it was made from, as a starting point the dialog can show
         before anything is read. It is replaced below by the frame the run
         says it should open on, which is the same picture whenever this clip
         was continued from the one before it -- and the right one when it was
         not, because a reordered or re-rolled neighbour makes the stored
         `source_image_id` a record of history rather than of the arrangement. */
      setFrame(
        typeof sourceId === 'string'
          ? {
              id: sourceId,
              url: imageUrl(sourceId, 'thumb'),
              title: 'Starting frame',
            }
          : null,
      )
      setEndFrame(null)

      const previous = index > 0 ? picked[index - 1] : undefined
      if (previous && !isPending(previous)) void loadFrameFrom(previous)

      /**
       * And the far seam, when anything follows.
       *
       * **The clip's own ending, not the next clip's beginning.** They are the
       * same picture whenever the next clip was continued from this one, which
       * is the case this exists for -- and only this one is already a library
       * row, so pinning it costs a query where the other costs decoding a
       * second clip. Director settled the same question the same way (#642).
       *
       * The last clip in a run gets none: there is no join after it, so it is
       * free to end anywhere.
       */
      const next = index + 1 < picked.length ? picked[index + 1] : undefined
      if (next && !isPending(clip)) {
        setEndFrameLoading(true)
        void resolveEndFrame(clip)
          .then(setEndFrame)
          // Silent, and the form stays usable: a replacement that is pinned at
          // one end is worse than one pinned at both and far better than none.
          .catch(() => setEndFrame(null))
          .finally(() => setEndFrameLoading(false))
      }
    },
    [picked, durationOf, loadFrameFrom, resolveEndFrame],
  )

  const dropFrame = useCallback(() => {
    setFrame(null)
    setFrameError(null)
  }, [])

  const dropEndFrame = useCallback(() => setEndFrame(null), [])

  /**
   * Submit, and put the clip in the run before it exists.
   *
   * The row is reserved server-side before FAL is contacted, so `recordId` is a
   * real row the moment this returns -- but this render does not have it yet,
   * and waiting for a refresh would leave the run unchanged for a second or two
   * after a press that cost money. A placeholder carrying the id takes the
   * position immediately and the reconcile effect above swaps the real row in.
   */
  const submitGen = useCallback(async () => {
    if (!target || busy) return
    const text = prompt.trim()
    if (!text) return

    /* The inputs choose the model, exactly as they do on Video: a reference
       means Kling O3 Pro, which is the only one taking references and a
       starting frame together, and none means H3 Max Turbo. See `gen.ts`. */
    const ratios = genRatiosFor(refs.length)

    setBusy(true)
    try {
      const { recordId } = await generateVideo({
        images: [
          ...(frame ? [{ id: frame.id, role: 'first' as const }] : []),
          ...refs.map((ref) => ({ id: ref.id, role: 'reference' as const })),
          ...(endFrame ? [{ id: endFrame.id, role: 'last' as const }] : []),
        ],
        prompt: text,
        duration,
        /* Ignored by H3's image endpoint, which has no such parameter and
           follows the frame; a real choice only when there is no frame. Kling's
           reference endpoint does take one and validates it, so whichever of
           the two this is, it is brought back to a shape the endpoint names. */
        aspectRatio:
          frame || endFrame
            ? nearestRatio(ratios, runRatio)
            : clampRatio(ratios, ratio),
        modelSlug: refs.length > 0 ? REF_MODEL_SLUG : GEN_MODEL_SLUG,
        origin: 'director',
      })

      const placeholder: VideoRecord = {
        id: recordId,
        // The model the inputs chose, not the page's default -- the row's own
        // title is written server-side from the same choice.
        title: genModelFor(refs.length).label,
        description: text,
        status: 'pending',
        generation_error: null,
        created_at: new Date().toISOString(),
        group_id: null,
        generation_metadata: {
          duration_seconds: duration,
          ...(frame ? { source_image_id: frame.id } : {}),
          ...(endFrame ? { end_image_id: endFrame.id } : {}),
          ...(refs.length > 0
            ? { reference_image_ids: refs.map((r) => r.id) }
            : {}),
        },
        width: null,
        height: null,
        hidden_at: null,
        has_end_frame: false,
      }

      setPicked((current) => {
        if (target.kind === 'append') return [...current, placeholder]
        const next = [...current]
        const [replaced] = next.splice(target.index, 1, placeholder)
        /* The take that dropped out is trashed (#679). It used to stay in
           Video for cleaning up by hand; nothing shows it now, so it goes
           where a re-roll you did not keep belongs. Restorable from Trash. */
        trashClip(replaced.id).catch(() =>
          toast.error('The replaced clip could not be trashed'),
        )
        return next
      })

      setGenOpen(false)
      setEditing(null)
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : 'Could not start that generation',
      )
    } finally {
      setBusy(false)
    }
  }, [
    target,
    busy,
    prompt,
    frame,
    endFrame,
    refs,
    duration,
    ratio,
    runRatio,
    router,
  ])

  return {
    error,
    chat,
    inFlight,
    /** Questions waiting behind the one with the model. */
    queued: questions.slice(1).map((q) => q.question),
    answering,
    answerReady,
    ask,
    loop,
    setLoop,
    transcript,
    transcriptOpen,
    setTranscriptOpen,
    picked,
    playable,
    toPlayableIndex: playableIndexOf,
    toRowIndex: rowIndexOf,
    runRatio,
    playingIndex: picked.length > 0 ? playingIndex : null,
    setPlayingIndex,
    scriptOpen,
    setScriptOpen,
    script,
    removeClip,
    move,
    editing,
    setEditing,
    renameClip,
    genOpen,
    setGenOpen,
    openAdd,
    openEdit,
    submitGen,
    genForm: {
      frame,
      frameLoading,
      frameError,
      onDropFrame: dropFrame,
      endFrame,
      endFrameLoading,
      onDropEndFrame: dropEndFrame,
      refs,
      /* Only the finished clips: a pending row has nothing behind `/img/[id]`
         to cut a frame out of. */
      runClips: picked.filter((c) => c.status === 'completed'),
      onAddRefs: addRefs,
      onDropRef: dropRef,
      prompt,
      onPromptChange: setPrompt,
      duration,
      onDurationChange: setDuration,
      ratio,
      onRatioChange: setRatio,
      busy,
    },
  }
}
