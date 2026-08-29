'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { aspectLabel, aspectRatio, clipFacts, sameAspect } from '../clip-facts'
import { ClipFrames } from '../clip-frames/clip-frames'
import styles from './clip-picker.module.css'
import type { VideoRecord } from '../../../video/_actions/generate-video.action'
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components'

/** The edge of one frame. A tile holds two, so `--tile` in the stylesheet --
 *  the grid's column width -- is twice this: a `MediaBox` is sized in px, not
 *  by its container. */
const TILE = 132

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
 * **Shared across lab pages, which is why it sits in `lab/_components/`.**
 * Frames built it and Sequence wanted it whole (#497); a second copy under
 * another page's `_components/` would be the same dialog drifting into two.
 *
 * **`max` defaults to 1 and the whole thing is written for more.** Selection is
 * a set and the caller takes an array, so picking several clips — to stitch, to
 * compare — is raising a number rather than rewriting this.
 *
 * **Both ends of each clip, the same as the run** (`ClipFrames`). It showed a
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
export function ClipPicker({
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
  clips: Array<VideoRecord>
  pickedIds: Set<string>
  onConfirm: (clips: Array<VideoRecord>) => void
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
    onConfirm(
      ids.map((id) => byId.get(id)).filter((c): c is VideoRecord => !!c),
    )
    setSelectedIds([])
    onOpenChange(false)
  }

  const toggle = (id: string) => {
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
      <DialogContent size="wide" className={styles.popup}>
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
                    />
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
