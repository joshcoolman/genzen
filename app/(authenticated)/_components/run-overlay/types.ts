/**
 * What a long-running job tells the overlay (#725). The seam with #737: a
 * durable News run will emit exactly these, and until it exists the fake run
 * beside this file does.
 *
 * Every event is something that actually happened -- a source read, a headline
 * validated, a picture finished. Nothing here is timer-driven narration, and
 * there is no percentage: `total` is sent only once it is known.
 */
export type RunEvent =
  /** What the job is doing now. Replaces the previous activity. */
  | { kind: 'activity'; text: string }
  /** A real artifact surfacing: a source, a headline, an illustration concept. */
  | { kind: 'snippet'; label: string; text: string }
  /** One unit of output settled. `total` once known. */
  | { kind: 'item'; done: number; total?: number; text?: string }
  | {
      kind: 'end'
      outcome: 'success' | 'empty' | 'failed'
      text: string
      /** Where View goes. */
      href?: string
    }

export interface RunSnapshot {
  id: string
  title: string
  activity: string
  /** Newest first, capped. */
  snippets: Array<{ id: number; label: string; text: string }>
  done: number
  total?: number
  end?: Extract<RunEvent, { kind: 'end' }>
  /** Bumped on every event, so the animation can pulse on arrival. */
  beat: number
}

/** A job the overlay can watch. Returns a stop function. */
export type RunSource = (emit: (event: RunEvent) => void) => () => void
