'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { ClipFrames } from '../clip-frames/clip-frames'
import { Button } from '../button/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../dialog/dialog'
import styles from './clip-picker.module.css'
import type { ClipTile } from '#/features/video/clip-facts'
import {
  aspectLabel,
  aspectRatio,
  clipFacts,
  sameAspect,
} from '#/features/video/clip-facts'
import { useHoldToPlay } from '#/lib/use-hold-to-play'

/** The edge of one frame. A tile holds three, so `--tile` in the stylesheet --
 *  the grid's column width -- is three times this: a `MediaBox` is sized in
 *  px, not by its container. */
const TILE = 120

/** The clip's midpoint, off the row's requested length, or nothing. */
function midpointOf(clip: ClipTile): number | undefined {
  const seconds = (clip.generation_metadata ?? {}).duration_seconds
  return typeof seconds === 'number' && seconds > 0 ? seconds / 2 : undefined
}

/**
 * Pick a clip out of the ones you have made.
 *
 * **`ExistingImagePicker`'s shape, deliberately** — the same dialog, the same
 * grid of tiles, the same footer counter, the same click-to-confirm when only
 * one is wanted. Picking a clip should feel like picking a reference image
 * because it is the same act.
 *
 * **Not that component with a flag, though.** It renders `Thumbnail`, which is
 * an `<img>`, and an mp4 handed to an `<img>` lands on the broken-file
 * fallback. Teaching it video means a media element inside the primitive every
 * still in the app renders through, which is the thing `MediaBox` exists to
 * avoid (#398) — and it would mean that change landing across Images, Canvas
 * and Video to serve one lab page. Its source filters (Uploads / AI Generated)
 * are meaningless here too.
 *
 * So: this shape, in the lab, where it can be used before anyone decides
 * whether the app's picker should grow a video mode. If it proves out, the real
 * generalisation gets designed against two consumers instead of a guess.
 *
 * **It lives in `src/components/` because Director draws it too** (#662).
 * Frames built it in the lab and Sequence wanted it whole (#497); when Sequence
 * became Director's workspace the app would have had to import from the lab,
 * which is the one direction the dependency may not run. So it moved, and takes
 * `ClipTile` -- the structural row -- rather than naming a route's type. It is
 * generic over it, so a caller confirms with its own rows.
 *
 * **`max` defaults to 1 and the whole thing is written for more.** Selection is
 * a set and the caller takes an array, so picking several clips — to stitch, to
 * compare — is raising a number rather than rewriting this.
 *
 * **Three frames of each clip: both ends, as the run shows them, and the
 * middle** (`ClipFrames`, #726). A run of Continue clips all open on the frame
 * the previous one ended on, so first and last match across the whole set
 * and only the midpoint says which is which. It is a seek further into the
 * file, so it paints a beat after the ends do. **And a press held on a tile
 * plays the clip in place**, sound on, until the press ends -- the clips are
 * five to fifteen seconds, and watching one here is faster than anywhere else.
 * The dialog is `size="full"` to make room for both.
 * It showed a
 * first frame only, which meant the dialog you choose a clip in could not
 * answer the question you were choosing for: what a clip cuts into is decided
 * by the frame it *ends* on, and that frame was the one place it was never
 * shown. Frames gets them too -- it picks a clip to pull a frame out of, and
 * which frames there are is exactly its question.
 *
 * **`matchRatio` narrows the grid to one shape, and only Sequence passes it**
 * (#512). Clips of different shapes cannot cut together — a portrait clip after
 * a landscape one has to be cropped or letterboxed mid-run — so once a run has
 * a shape, the clips that can join it are the ones that share it. Passed by the
 * caller rather than inferred here: the constraint is a fact about a *run*, and
 * Frames, which picks one clip to pull a frame out of, has no run and no
 * constraint.
 *
 * It filters rather than forbids, and the count of what it hid is on screen
 * with the way back beside it. A hidden clip you cannot see the absence of is
 * the dialog lying about what you own — and the shape a run should be is
 * occasionally the thing you are still deciding.
 */
export function ClipPicker<T extends ClipTile>({
  open,
  onOpenChange,
  clips,
  pickedIds,
  onConfirm,
  max = 1,
  matchRatio = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  clips: Array<T>
  pickedIds: Set<string>
  onConfirm: (clips: Array<T>) => void
  max?: number
  /** The shape the picked clips must share, or null for no constraint (#512). */
  matchRatio?: number | null
}) {
  /**
   * **An ordered list, not a set: the order you click in is the answer** (#497).
   *
   * It was a `Set`, and confirming mapped it back through `clips.filter`, which
   * quietly returned library order however you had clicked. That is invisible
   * with one clip and wrong with several -- picking four in the order you want
   * them to play handed back four in the order they happened to be listed.
   *
   * Unpicking closes the gap and repicking lands at the end, which is the
   * natural consequence rather than a rule to remember: the numbers on the
   * tiles say so as it happens.
   */
  const [selectedIds, setSelectedIds] = useState<Array<string>>([])
  /** An escape hatch, not a preference: it resets with the dialog, below. */
  const [showAllRatios, setShowAllRatios] = useState(false)

  /* Press and hold plays the clip in place; let go and the frames are back
     (#726). Three stills tell most clips apart, and the ones they do not are
     five to eight seconds long -- shorter than opening them anywhere else. */
  const hold = useHoldToPlay()
  const { end: endHold } = hold
  useEffect(() => {
    if (!open) endHold()
  }, [open, endHold])

  /* A clip with no recorded shape is hidden by the filter rather than let
     through. Letting it through would put the one clip nobody can vouch for
     into the run the filter exists to keep consistent -- and "Show all" is
     right there, saying how many it is holding back. */
  const shown = useMemo(() => {
    if (matchRatio == null || showAllRatios) return clips
    return clips.filter((clip) => sameAspect(aspectRatio(clip), matchRatio))
  }, [clips, matchRatio, showAllRatios])

  const hiddenCount = clips.length - shown.length

  // One clip means the click *is* the answer: a footer button to confirm a
  // choice that can only be one thing is a second click for nothing.
  const autoConfirm = max === 1

  useEffect(() => {
    if (!open) {
      setSelectedIds([])
      // Reopening starts constrained again. The override answers "let me look
      // at everything this once"; a dialog that stayed unfiltered would quietly
      // drop the constraint for the rest of the session.
      setShowAllRatios(false)
    }
  }, [open])

  const confirm = (ids: Array<string>) => {
    const byId = new Map(clips.map((c) => [c.id, c]))
    onConfirm(ids.map((id) => byId.get(id)).filter((c): c is T => !!c))
    setSelectedIds([])
    onOpenChange(false)
  }

  const toggle = (id: string) => {
    // The click that ends a hold is the hold ending, not a choice.
    if (hold.consumeHold()) return
    if (autoConfirm) {
      confirm([id])
      return
    }
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((existing) => existing !== id)
      return prev.length < max ? [...prev, id] : prev
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full" className={styles.popup}>
        <DialogHeader>
          <DialogTitle>Clips</DialogTitle>
          {matchRatio != null && (
            <div className={styles.filter}>
              <span>
                {showAllRatios
                  ? `Every shape · the run is ${aspectLabel(matchRatio)}`
                  : `${aspectLabel(matchRatio)}, to match the run`}
              </span>
              {(hiddenCount > 0 || showAllRatios) && (
                <button
                  type="button"
                  className={styles.filterToggle}
                  onClick={() => setShowAllRatios((v) => !v)}
                >
                  {showAllRatios
                    ? 'Match the run'
                    : `Show all (${hiddenCount} hidden)`}
                </button>
              )}
            </div>
          )}
        </DialogHeader>

        <div className={styles.grid}>
          {shown.length === 0 ? (
            <div className={styles.state}>
              {clips.length === 0
                ? 'No clips yet'
                : `No clips are ${aspectLabel(matchRatio)}`}
            </div>
          ) : (
            <div className={styles.tiles}>
              {shown.map((clip) => {
                /* The one already loaded reads as chosen and stays clickable:
                   with a single slot the picker is how you *change* clips, and
                   greying out the current one makes the dialog look broken when
                   you open it to look around and decide to keep what you had. */
                const order = selectedIds.indexOf(clip.id)
                const selected =
                  order !== -1 || (autoConfirm && pickedIds.has(clip.id))
                // Only where a second copy would be meaningless.
                const alreadyIn = !autoConfirm && pickedIds.has(clip.id)

                return (
                  <button
                    key={clip.id}
                    type="button"
                    className={selected ? styles.tileSelected : styles.tile}
                    onClick={() => toggle(clip.id)}
                    {...hold.handlersFor(clip.id)}
                    disabled={alreadyIn}
                    aria-pressed={selected}
                    /* The prompt, which is the only thing that tells two clips
                       from the same model apart, and far too long to print
                       under 132px of picture. */
                    title={clip.description ?? clip.title}
                  >
                    {/* `contain`, not `cover`. A square crop of a 720x1280
                        clip is the middle band of it -- the subject's face is
                        the first thing gone -- so a portrait clip and a
                        landscape one from the same prompt became two tiles
                        showing the same strip of background, and one of them
                        read as missing from the dialog entirely. Letterboxed,
                        the shape of the clip is visible too, which is a fact
                        worth having when you are choosing one. */}
                    <ClipFrames
                      clip={clip}
                      size={TILE}
                      alt={clip.title}
                      pad={0}
                      mid={midpointOf(clip)}
                    />
                    {/* Over the three frames, the same box, gone on release.
                        Sound on, as the stage's is: the sound is part of what
                        is being judged. */}
                    {hold.playingId === clip.id && (
                      <video
                        className={styles.preview}
                        src={`/img/${clip.id}`}
                        autoPlay
                        loop
                        playsInline
                      />
                    )}
                    {/* The position in the run being built, not a tick: with
                        several clips the useful fact is *where* this one lands,
                        and a tick says only "yes". A tick still, where there is
                        only ever one -- "1" over a lone choice is a number that
                        can never be anything else. */}
                    {order !== -1 && (
                      <span className={styles.check}>
                        {autoConfirm ? <Check /> : order + 1}
                      </span>
                    )}
                    {/* The model and the duration: at five hundred clips a
                        first frame does not tell them apart, and these are the
                        two facts already on the row. */}
                    <span className={styles.facts}>{clipFacts(clip)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className={styles.footer}>
          <div className={styles.footerInner}>
            <span className={styles.count}>
              {selectedIds.length}/{max} selected
            </span>
            {!autoConfirm && (
              <Button
                variant="primary"
                onClick={() => confirm(selectedIds)}
                disabled={selectedIds.length === 0}
              >
                Add {selectedIds.length > 0 ? `${selectedIds.length} ` : ''}
                Selected
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
