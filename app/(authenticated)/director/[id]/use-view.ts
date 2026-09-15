'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateVideo } from '../../video/_actions/generate-video.action'
import { writeRun } from '../_actions/sessions.action'
import { GEN_MODEL_SLUG, genModel, nearestGenRatio } from './gen'
import { isPending, playableClips, toPlayableIndex, toRowIndex } from './run'
import type { GenFrame } from './_components/gen-form/gen-form'
import type { Session } from '../_lib/types'
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
import { toast } from '#/components'

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
  const [pickerOpen, setPickerOpen] = useState(false)
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
   * Append, skipping anything already in the run.
   *
   * A clip twice in one sequence is a real thing to want eventually and a
   * confusing thing to get by accident, since the picker shows what is already
   * picked. Appending only what is new means the row's ids stay unique, which
   * is what lets a card key on one.
   */
  const addClips = useCallback((chosen: Array<VideoRecord>) => {
    setPicked((current) => {
      const have = new Set(current.map((c) => c.id))
      return [...current, ...chosen.filter((c) => !have.has(c.id))]
    })
  }, [])

  const removeClip = useCallback((id: string) => {
    setPicked((current) => current.filter((c) => c.id !== id))
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

  /* The row shows a clip being made and the player cannot, so the two are
     indexed apart. `run.ts` owns both directions; see there. */
  const playable = useMemo(() => playableClips(picked), [picked])

  const playableIndexOf = useCallback(
    (rowIndex: number) => toPlayableIndex(picked, rowIndex),
    [picked],
  )

  const rowIndexOf = useCallback(
    (playableIndex: number | null) => toRowIndex(picked, playableIndex),
    [picked],
  )

  /* The shape of the run: the first *finished* clip's, since a clip still being
     made has no pixels to measure yet. */
  const runRatio = playable.length > 0 ? aspectRatio(playable[0]) : null

  /* What the picker may offer. A pending row has no object behind `/img/[id]`,
     so choosing one gets you a blank stage -- the same rule the page has always
     applied, now that the run itself can hold one. */
  const pickable = useMemo(
    () => clips.filter((c) => c.status === 'completed'),
    [clips],
  )

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
  const [busy, setBusy] = useState(false)

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
   * Add gen: make the clip that comes after the run.
   *
   * **The frame comes from the last clip, whatever it is.** That is the whole
   * assumption the button rests on -- appending to a run means carrying on from
   * where it ended -- and it holds without knowing anything else about the clip
   * before it. An empty run has nothing to carry on from, which is the one case
   * that starts as text-to-video and shows the ratio pills.
   */
  const openAdd = useCallback(() => {
    const last = picked.at(-1)
    setTarget({ kind: 'append' })
    setPrompt('')
    setDuration(model.defaultDuration)
    setRatio(nearestGenRatio(runRatio))
    setFrame(null)
    setFrameError(null)
    // Appending has no join after it, so there is never an ending to pin.
    setEndFrame(null)
    setEndFrameLoading(false)
    setGenOpen(true)
    // A clip still being made has no last frame to read, so appending after one
    // starts from nothing rather than waiting on it.
    if (last && last.status === 'completed') void loadFrameFrom(last)
  }, [picked, runRatio, model.defaultDuration, loadFrameFrom])

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
      const seconds = meta.duration_seconds

      setTarget({ kind: 'replace', index })
      setPrompt(clip.description ?? '')
      setDuration(
        typeof seconds === 'number' && model.durations.includes(seconds)
          ? seconds
          : model.defaultDuration,
      )
      setRatio(nearestGenRatio(aspectRatio(clip)))
      setFrameError(null)

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
    [
      picked,
      model.durations,
      model.defaultDuration,
      loadFrameFrom,
      resolveEndFrame,
    ],
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

    setBusy(true)
    try {
      const { recordId } = await generateVideo({
        images: [
          ...(frame ? [{ id: frame.id, role: 'first' as const }] : []),
          ...(endFrame ? [{ id: endFrame.id, role: 'last' as const }] : []),
        ],
        prompt: text,
        duration,
        // Ignored by the image endpoint, which has no such parameter and
        // follows the frame; the real choice only when there is no frame.
        aspectRatio: frame || endFrame ? nearestGenRatio(runRatio) : ratio,
        modelSlug: GEN_MODEL_SLUG,
      })

      const placeholder: VideoRecord = {
        id: recordId,
        title: model.label,
        description: text,
        status: 'pending',
        generation_error: null,
        created_at: new Date().toISOString(),
        group_id: null,
        generation_metadata: {
          duration_seconds: duration,
          ...(frame ? { source_image_id: frame.id } : {}),
          ...(endFrame ? { end_image_id: endFrame.id } : {}),
        },
        width: null,
        height: null,
        hidden_at: null,
        has_end_frame: false,
      }

      setPicked((current) => {
        if (target.kind === 'append') return [...current, placeholder]
        const next = [...current]
        next.splice(target.index, 1, placeholder)
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
    duration,
    ratio,
    runRatio,
    model.label,
    router,
  ])

  return {
    error,
    clips: pickable,
    picked,
    playable,
    toPlayableIndex: playableIndexOf,
    toRowIndex: rowIndexOf,
    runRatio,
    playingIndex: picked.length > 0 ? playingIndex : null,
    setPlayingIndex,
    pickerOpen,
    setPickerOpen,
    addClips,
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
