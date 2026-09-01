'use client'

import type { PickedImage } from '../_components/image-input/image-input'

/**
 * The two pictures every effect is tested on (#562).
 *
 * **Two, not one, and the second one is not a person.** The issue asked for a
 * single canonical portrait. A portrait-only grid cannot show the failure this
 * feature has already had: #566's split field passed on faces and came back on
 * a truck as two flat colour rectangles with the paint untouched, because the
 * prose described a photograph instead of a lighting setup. That is precisely
 * the mistake this page exists to catch, and a test whose inputs cannot show
 * the failure is worse than no test -- it reports success. So: a face and a
 * hard-surfaced object, side by side, every time.
 *
 * **Held constant is the whole point.** The same pair under every effect
 * forever, which is what makes two grids comparable at a glance -- the same
 * trick that makes the Shots angle grid readable.
 *
 * **They are library picks pinned here rather than files checked into
 * `public/`**, which is where they would end up if this graduates. Checked-in
 * subjects are the right answer for something that ships; they are the wrong
 * answer for a page whose first job is finding out which two pictures are
 * actually good tests. Pin, use, argue with the choice, and freeze it into the
 * repo once it has stopped changing.
 */

const KEY = 'genzen:lab:lighting:subjects'

export type SubjectSlot = 'portrait' | 'object'

export const SUBJECT_SLOTS: Array<{
  slot: SubjectSlot
  label: string
  hint: string
}> = [
  {
    slot: 'portrait',
    label: 'Portrait',
    hint: 'A face. Where a lighting setup is easiest to judge.',
  },
  {
    slot: 'object',
    label: 'Object',
    hint: 'A car, a chair, a product. Where prose that described a photograph falls apart.',
  },
]

export type PinnedSubjects = Partial<Record<SubjectSlot, PickedImage>>

export function writeSubjects(subjects: PinnedSubjects): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(subjects))
  } catch {
    // A blocked store means the pair is asked for again next visit, which is an
    // annoyance rather than a wrong answer.
  }
}

export function readSubjects(): PinnedSubjects {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return {}
  }
  if (!raw) return {}

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const out: PinnedSubjects = {}
    for (const { slot } of SUBJECT_SLOTS) {
      const value = (parsed as Record<string, unknown>)[slot]
      const picked = value as Partial<PickedImage> | undefined
      if (typeof picked?.id === 'string' && typeof picked.url === 'string') {
        out[slot] = {
          id: picked.id,
          url: picked.url,
          title: typeof picked.title === 'string' ? picked.title : '',
        }
      }
    }
    return out
  } catch {
    return {}
  }
}
