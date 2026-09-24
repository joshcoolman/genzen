'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { continueClip } from '../_actions/continue.action'
import { attachFramesGroup, writeCut } from '../_actions/edits.action'
import { exportToVideo } from '../_actions/export.action'
import {
  isReady,
  locate,
  playableOf,
  splitSpan,
  startOf,
  toPlayableIndex,
  toRowIndex,
  totalSeconds,
} from './cut'
import type {
  CutPlayerHandle,
  PlayableItem,
} from './_components/cut-player/cut-player'
import type { Edit, EditFrame } from '../_lib/types'
import type { VideoRecord } from '../../video/_actions/generate-video.action'
import { aspectRatio, clipModel, clipName } from '#/features/video/clip-facts'
import { captureFrameAt } from '#/features/video/frame-capture'
import { endpointFor, videoModelBySlug } from '#/features/video/models'
import { findClipEndFrame } from '#/features/video/server/find-clip-end-frame.action'
import { useGenerationPoll } from '#/features/ai-images/hooks/use-generation-poll'
import { createImageGroup } from '#/features/groups/groups.action'
import { imageUrl } from '#/lib/image-url'
import { saveFileToLibrary } from '#/features/user-images/lib/save-to-library'
import { softDeleteImage } from '#/features/user-images/server/images.action'
import { stampFrameSource } from '#/features/video/server/stamp-frame.action'
import { useAuth } from '#/lib/auth'
import { toast } from '#/components'

/** The row's requested length, or a guess a metadata load will correct. */
function requestedSeconds(clip: VideoRecord): number {
  const seconds = clip.generation_metadata?.duration_seconds
  return typeof seconds === 'number' && seconds > 0 ? seconds : 5
}

/** A frame in a Continue slot: a library row and how to show it. */
export interface JoinFrame {
  id: string
  url: string
  title: string
}

/** What Continue is about to make (#731). Null while the dialog is closed. */
export interface ContinueDraft {
  /** The row it goes after, by key: a re-order while the dialog is open still
   *  lands it after the clip it was opened on. */
  afterKey: string
  /** The highlighted clip's frame at its out point. Null while reading, or
   *  on a failure the dialog says. */
  first: JoinFrame | null
  firstLoading: boolean
  /** The next clip's frame at its in point, or null when nothing follows or
   *  it was dropped. */
  last: JoinFrame | null
  lastLoading: boolean
  error: string | null
  modelSlug: string
  duration: number
  resolution: string | undefined
  prompt: string
}

/** Where the clip goes when the dialog opens. Cheap, and its endpoint takes
 *  both frames. */
const DEFAULT_CONTINUE_MODEL = 'h3-max-turbo'

/** The named ratio closest to the run's shape -- Director's `nearestRatio`.
 *  H3's image endpoint ignores it and follows the frame; Kling's validates
 *  it, so it is a name the endpoint offers. */
function nearestRatio(ratios: Array<string>, value: number | null): string {
  if (!value || !Number.isFinite(value) || ratios.length === 0) return '16:9'
  return ratios
    .map((id) => {
      const [w, h] = id.split(':').map(Number)
      return { id, value: w / h }
    })
    .reduce((best, option) =>
      Math.abs(option.value - value) < Math.abs(best.value - value)
        ? option
        : best,
    ).id
}

/**
 * A cut of trimmed clips, in the order they play (#726).
 *
 * Director's hook with a span per clip. The state is the list of
 * `{ key, clip, in, out }`; the key is client-side and stable across reorders,
 * because one clip may be in the cut twice and a position is not an identity.
 * It is stripped before the write -- the row stores `{ id, in, out }`.
 *
 * Saved on every change against the revision, one write at a time, on
 * Director's reasoning; a failed save is said, not rolled back.
 */
export function useView(
  edit: Edit,
  clips: Array<VideoRecord>,
  initialFrames: Array<EditFrame>,
) {
  const { user } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<Array<PlayableItem>>(() => {
    const byId = new Map(clips.map((c) => [c.id, c]))
    return edit.cut.clips.flatMap((stored) => {
      const clip = byId.get(stored.id)
      return clip
        ? [{ key: crypto.randomUUID(), clip, in: stored.in, out: stored.out }]
        : []
    })
  })

  const revision = useRef(edit.revision)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const serialise = (list: Array<PlayableItem>) =>
    JSON.stringify(list.map((i) => [i.clip.id, i.in, i.out]))
  const saved = useRef(serialise(items))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const key = serialise(items)
    if (key === saved.current) return
    saved.current = key
    const stored = items.map((i) => ({ id: i.clip.id, in: i.in, out: i.out }))
    queue.current = queue.current.then(async () => {
      try {
        revision.current = (
          await writeCut(edit.id, revision.current, stored)
        ).revision
        setError(null)
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'The cut could not be saved.',
        )
      }
    })
  }, [items, edit.id])

  /**
   * Take the rows from the server's, whenever the server's change (#731).
   *
   * A clip Continue is making enters the cut as a placeholder the moment its
   * row is reserved and is `pending` until the poll settles it; this swaps
   * the real row in, in place. Ids missing from `clips` are kept (a row
   * reserved a second ago that this render has not fetched), on Director's
   * reasoning. A row that failed leaves the cut and says why.
   */
  useEffect(() => {
    if (clips.length === 0) return
    const byId = new Map(clips.map((c) => [c.id, c]))
    setItems((current) => {
      const next = current.map((item) => {
        const fresh = byId.get(item.clip.id)
        return fresh && fresh !== item.clip ? { ...item, clip: fresh } : item
      })
      return next.some((item, i) => item !== current[i]) ? next : current
    })
  }, [clips])
  useEffect(() => {
    const failed = items.filter((i) => i.clip.status === 'failed')
    if (failed.length === 0) return
    for (const item of failed) {
      toast.error(item.clip.generation_error ?? 'A clip could not be made')
    }
    setItems((current) => current.filter((i) => i.clip.status !== 'failed'))
  }, [items])
  const pendingSince = useMemo(() => {
    const times = items
      .filter((i) => i.clip.status === 'pending')
      .map((i) => i.clip.created_at)
      .sort()
    return times[0] ?? null
  }, [items])
  useGenerationPoll(pendingSince, () => router.refresh())

  /** The cut as the stage plays it: the ready rows, in order (#731). */
  const playable = useMemo(() => playableOf(items), [items])

  /* Each clip's real length, learned as the player or a tile loads its
     metadata. The out handle stops there. */
  const [durations, setDurations] = useState<Map<string, number>>(new Map())
  const learnDuration = useCallback((id: string, seconds: number) => {
    setDurations((current) => {
      if (current.get(id) === seconds) return current
      return new Map(current).set(id, seconds)
    })
  }, [])

  const [picking, setPicking] = useState(false)
  const add = useCallback((chosen: Array<VideoRecord>) => {
    setItems((current) => [
      ...current,
      ...chosen.map((clip) => ({
        key: crypto.randomUUID(),
        clip,
        in: 0,
        out: requestedSeconds(clip),
      })),
    ])
  }, [])

  const remove = useCallback((key: string) => {
    setItems((current) => current.filter((i) => i.key !== key))
  }, [])

  const move = useCallback((from: number, to: number) => {
    setItems((current) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= current.length ||
        to >= current.length
      )
        return current
      const next = [...current]
      const [lifted] = next.splice(from, 1)
      next.splice(to, 0, lifted)
      return next
    })
  }, [])

  const trim = useCallback((key: string, span: { in: number; out: number }) => {
    setItems((current) =>
      current.map((i) => (i.key === key ? { ...i, ...span } : i)),
    )
  }, [])

  /* The strip drives the player and nothing drives the strip, so the calls
     between them are imperative (Director's reasoning): a tile click has to
     reach the `<video>` elements. Held here so the keys below can reach them
     too. */
  const player = useRef<CutPlayerHandle>(null)

  /**
   * Where the stage is, as the player reports it: an index into `playable`
   * and an offset into that clip's kept span. Two clocks derive from it --
   * `time`, over the ready clips, which is what the readout shows and the
   * keys move on; and `stripSeconds`, over every row, which is where the
   * playhead is drawn, since a pending row holds width on the strip that the
   * stage skips.
   */
  const [position, setPosition] = useState({ index: 0, offset: 0 })
  const setPositionFrom = useCallback((index: number, offset: number) => {
    setPosition({ index, offset })
  }, [])
  const [playableIndex, setPlayableIndex] = useState<number | null>(null)
  const playingIndex = useMemo(
    () => toRowIndex(items, playableIndex),
    [items, playableIndex],
  )
  const time = useMemo(
    () => startOf(playable, position.index) + position.offset,
    [playable, position],
  )
  const stripSeconds = useMemo(() => {
    const row = toRowIndex(items, position.index)
    return row === null ? 0 : startOf(items, row) + position.offset
  }, [items, position])
  const [playing, setPlaying] = useState(false)

  /** A strip position, to the player. A pending row cannot be played, so a
   *  press on one is nothing. */
  const playFromRow = useCallback(
    (rowIndex: number, offset = 0) => {
      const index = toPlayableIndex(items, rowIndex)
      if (index >= 0) player.current?.seekTo(index, offset)
    },
    [items],
  )
  /** A moment on the strip, to the player: the row under it, or the next
   *  ready one when that row is still being made. */
  const seekStrip = useCallback(
    (seconds: number) => {
      const at = locate(items, seconds)
      if (!at) return
      let row = at.index
      let offset = at.offset
      while (row < items.length && !isReady(items[row])) {
        row++
        offset = 0
      }
      if (row < items.length) playFromRow(row, offset)
    },
    [items, playFromRow],
  )

  /**
   * Split the clip under the playhead in two, there (#729). Paused only: a
   * running clip has no single frame to cut on, which is the same reason F
   * pauses first. The left piece keeps its key, so it stays where it was; the
   * right one is new and starts at the playhead, which is where the stage is
   * -- nothing moves on screen except a seam appearing.
   */
  const head = useMemo(() => locate(playable, time), [playable, time])
  const canSplit =
    !playing &&
    head !== null &&
    splitSpan(playable[head.index], head.offset) !== null
  const split = useCallback(() => {
    if (!head || playing) return
    const key = playable[head.index]?.key
    setItems((current) => {
      const row = current.findIndex((i) => i.key === key)
      if (row < 0) return current
      const halves = splitSpan(current[row], head.offset)
      if (!halves) return current
      const [left, right] = halves
      return [
        ...current.slice(0, row),
        left,
        { ...right, key: crypto.randomUUID() },
        ...current.slice(row + 1),
      ]
    })
  }, [head, playing, playable])

  /**
   * The frames saved out of this edit (#729): rows in the edit's image
   * group, which Images also draws, so a trash on either side is the same
   * write. The group is made on the first press of F, named after the edit,
   * and its id is held here for the presses after.
   */
  const [frames, setFrames] = useState(initialFrames)
  const groupId = useRef(edit.group_id)
  const ensureGroup = useCallback(async () => {
    if (groupId.current) return groupId.current
    const made = await createImageGroup(edit.name, [], 'image')
    const id = made.groups[0]?.id
    if (!id) throw new Error('The frames group could not be made.')
    await attachFramesGroup(edit.id, id)
    groupId.current = id
    return id
  }, [edit.id, edit.name])
  /** A captured frame into the library, into the group, onto the strip. */
  const saveFrame = useCallback(
    async (blob: Blob, clip: VideoRecord, timeSeconds: number) => {
      const group = await ensureGroup()
      const at = timeSeconds.toFixed(2)
      const image = await saveFileToLibrary({
        userId: user.id,
        file: new File([blob], `frame-${clip.id}-${at}.png`, {
          type: 'image/png',
        }),
        title: `Frame · ${clipName(clip) ?? clipModel(clip)} · ${at}s`,
        description: clip.description,
        groupId: group,
      })
      // Best effort, as Director has it: a frame whose origin failed to stamp
      // is still a frame.
      void stampFrameSource({
        imageId: image.id,
        clipId: clip.id,
        timeSeconds,
        kind: 'scrub',
      }).catch(() => {})
      setFrames((current) => [
        { id: image.id, title: image.title, created_at: image.created_at },
        ...current,
      ])
      return image
    },
    [ensureGroup, user.id],
  )
  const [capturing, setCapturing] = useState(false)
  const capture = useCallback(async () => {
    const handle = player.current
    if (!handle || capturing) return
    setCapturing(true)
    try {
      const { frame: shot, clip, timeSeconds } = await handle.capture()
      await saveFrame(shot.blob, clip, timeSeconds)
      toast.success('Frame saved')
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : 'The frame could not be saved.',
      )
    } finally {
      setCapturing(false)
    }
  }, [capturing, saveFrame])

  /**
   * Continue (#731): the clip between the highlighted clip and the next.
   *
   * **Always called Continue, whatever it fills.** The first frame is the
   * highlighted clip at its out point; the last is the next ready clip at its
   * in point, when there is one -- so on the last clip it is a plain
   * continuation. Both are read off detached `<video>`s at the kept seconds
   * (`captureFrameAt`) and saved into the frames group, since they are the
   * frames the join is judged on; an untrimmed ending reuses the stored end
   * frame instead, on Director's reasoning (#542). The dialog opens at once
   * and the slots fill as the reads land.
   */
  const [draft, setDraft] = useState<ContinueDraft | null>(null)
  const frameOf = useCallback(
    async (clip: VideoRecord, seconds: number, ending: boolean) => {
      const known = durations.get(clip.id) ?? requestedSeconds(clip)
      if (ending && seconds >= known - 0.1) {
        const stored = await findClipEndFrame({ clipId: clip.id })
        if (stored) {
          return {
            id: stored.id,
            url: imageUrl(stored.id, 'thumb'),
            title: stored.title ?? `Frame · ${clip.title}`,
          }
        }
      }
      const shot = await captureFrameAt(`/img/${clip.id}`, seconds)
      const image = await saveFrame(shot.blob, clip, shot.timeSeconds)
      return {
        id: image.id,
        url: imageUrl(image.id, 'thumb'),
        title: image.title,
      }
    },
    [durations, saveFrame],
  )
  const openContinue = useCallback(() => {
    if (playing || playingIndex === null) return
    const row = items[playingIndex]
    const following = items.slice(playingIndex + 1).find(isReady) ?? null
    const model = videoModelBySlug(DEFAULT_CONTINUE_MODEL)
    setDraft({
      afterKey: row.key,
      first: null,
      firstLoading: true,
      last: null,
      lastLoading: following !== null,
      error: null,
      modelSlug: DEFAULT_CONTINUE_MODEL,
      duration: model?.defaultDuration ?? 6,
      resolution: undefined,
      prompt: '',
    })
    void frameOf(row.clip, row.out, true)
      .then((first) =>
        setDraft((d) =>
          d?.afterKey === row.key ? { ...d, first, firstLoading: false } : d,
        ),
      )
      .catch((err: unknown) =>
        setDraft((d) =>
          d?.afterKey === row.key
            ? {
                ...d,
                firstLoading: false,
                error:
                  err instanceof Error && err.message
                    ? `${err.message} -- the starting frame could not be read.`
                    : 'The starting frame could not be read.',
              }
            : d,
        ),
      )
    if (following) {
      void frameOf(following.clip, following.in, false)
        .then((last) =>
          setDraft((d) =>
            d?.afterKey === row.key ? { ...d, last, lastLoading: false } : d,
          ),
        )
        // Silent, and the form stays usable: pinned at one end beats none.
        .catch(() =>
          setDraft((d) =>
            d?.afterKey === row.key ? { ...d, lastLoading: false } : d,
          ),
        )
    }
  }, [playing, playingIndex, items, frameOf])
  /**
   * Submit, and put the clip in the cut before it exists. The dialog closes
   * on the press: the row is reserved server-side before FAL is contacted,
   * so `recordId` comes back in about a second and a placeholder the length
   * asked for takes its place after the clip it continues. The poll swaps
   * the real row in.
   */
  const submitContinue = useCallback(async () => {
    const d = draft
    if (!d || !d.first) return
    setDraft(null)
    const model = videoModelBySlug(d.modelSlug)
    if (!model) return
    try {
      const endpoint = endpointFor(model, true, d.last !== null)
      const { recordId } = await continueClip({
        firstId: d.first.id,
        lastId: d.last?.id ?? null,
        prompt: d.prompt,
        duration: d.duration,
        aspectRatio: nearestRatio(endpoint.aspectRatios, runRatioRef.current),
        resolution: d.resolution,
        modelSlug: d.modelSlug,
      })
      const placeholder: VideoRecord = {
        id: recordId,
        title: model.label,
        description: d.prompt,
        status: 'pending',
        generation_error: null,
        created_at: new Date().toISOString(),
        group_id: null,
        generation_metadata: { duration_seconds: d.duration },
        width: null,
        height: null,
        hidden_at: null,
        has_end_frame: false,
      }
      setItems((current) => {
        const at = current.findIndex((i) => i.key === d.afterKey)
        const item = {
          key: crypto.randomUUID(),
          clip: placeholder,
          in: 0,
          out: d.duration,
        }
        return at < 0
          ? [...current, item]
          : [...current.slice(0, at + 1), item, ...current.slice(at + 1)]
      })
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : 'The clip could not be started.',
      )
    }
  }, [draft])
  const trashFrame = useCallback((id: string) => {
    setFrames((current) => current.filter((f) => f.id !== id))
    void softDeleteImage(id).catch(() =>
      toast.error('The frame could not be trashed'),
    )
  }, [])

  /**
   * Space plays and pauses; Left and Right step a frame while paused, five
   * with Shift; F saves the frame on screen; S splits the clip at the
   * playhead; Delete and Backspace take out the highlighted clip. On the window, as Video's Escape is, and skipped when the key was
   * meant for something else: a field, a button (the stage is one, and Space
   * on a focused button is already a press), or the picker while it is open.
   */
  const removeIndex = useCallback((index: number) => {
    setItems((current) => current.filter((_, i) => i !== index))
  }, [])
  /** Move the paused stage by `count` frames, across a join if that is where
   *  the next frame is. On the run's clock, so a step back from a clip's
   *  first frame lands on the previous clip's last. */
  const step = useCallback(
    (count: number) => {
      const handle = player.current
      if (!handle || handle.isPlaying()) return
      const target = Math.max(
        0,
        Math.min(time + count * handle.frameSeconds(), totalSeconds(playable)),
      )
      const at = locate(playable, target)
      if (at) handle.seekTo(at.index, at.offset)
    },
    [playable, time],
  )
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (picking || draft || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        target?.isContentEditable
      )
        return
      if (e.key === ' ') {
        e.preventDefault()
        player.current?.toggle()
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        void capture()
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        split()
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Frame by frame while paused, five at a time with Shift. Nothing
        // while playing: a nudge under a running clip is not a thing you see.
        if (player.current?.isPlaying()) return
        e.preventDefault()
        step((e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 5 : 1))
      } else if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        playingIndex !== null
      ) {
        e.preventDefault()
        removeIndex(playingIndex)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [picking, draft, playingIndex, removeIndex, step, capture, split])

  /** The first clip's shape sets the stage's, as Director's does. */
  /**
   * Export: the cut as one clip on the Video wall. Awaited in place -- a
   * server action that runs ffmpeg over every clip takes seconds to a couple
   * of minutes, and the button says so while it does. The save queue is
   * awaited first so the file is cut from the edit as it is on screen.
   */
  const [exporting, setExporting] = useState(false)
  const exportCut = useCallback(async () => {
    if (exporting || items.length === 0) return
    setExporting(true)
    try {
      await queue.current
      const { videoId } = await exportToVideo(edit.id)
      toast.success('Exported to the Video wall', {
        action: {
          label: 'Open Video',
          onClick: () => window.open(`/video#${videoId}`, '_self'),
        },
      })
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'The export failed.')
    } finally {
      setExporting(false)
    }
  }, [edit.id, exporting, items.length])

  /** Where each clip sits in the cut, for the picker's badge: 1-based, one
   *  entry per use. */
  const positions = useMemo(() => {
    const map = new Map<string, Array<number>>()
    items.forEach((item, index) => {
      map.set(item.clip.id, [...(map.get(item.clip.id) ?? []), index + 1])
    })
    return map
  }, [items])

  const runRatio = useMemo(
    () => (playable[0] ? aspectRatio(playable[0].clip) : null),
    [playable],
  )
  const runRatioRef = useRef(runRatio)
  runRatioRef.current = runRatio
  const total = useMemo(() => totalSeconds(playable), [playable])

  return {
    player,
    frames,
    framesGroupId: groupId.current,
    capturing,
    capture,
    trashFrame,
    items,
    playable,
    playFromRow,
    seekStrip,
    stripSeconds,
    draft,
    setDraft,
    openContinue,
    submitContinue,
    durations,
    learnDuration,
    error,
    picking,
    setPicking,
    add,
    remove,
    move,
    trim,
    playingIndex,
    setPlayableIndex,
    setPositionFrom,
    playing,
    setPlaying,
    canSplit,
    split,
    time,
    runRatio,
    positions,
    total,
    exporting,
    exportCut,
  }
}
