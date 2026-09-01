'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { SUBJECT_SLOTS, readSubjects, writeSubjects } from './test-subjects'
import { deriveLightingEffect } from './_actions/derive-effect.action'
import { renderLightingCandidate } from './_actions/render-candidate.action'
import { saveLightingEffect } from './_actions/save-effect.action'
import { slugify } from './effect-file'
import type { SavedEffect } from './_actions/save-effect.action'
import type { PinnedSubjects, SubjectSlot } from './test-subjects'
import type { PickedImage } from '../_components/image-input/image-input'
import type { CapturedEffect } from './effect-file'
import {
  defaultLightingModelId,
  lightingModelIds,
} from '#/features/ai-images/lighting'
import { getModelsByCapability } from '#/features/ai-images/model-selector/unified-models'
import { estimateImageCostCents } from '#/features/ai-images/models'
import { useUserImages } from '#/features/user-images/hooks/use-user-images'
import { useAuth } from '#/lib/auth'

/** Two candidates per subject, four tiles. Four is what tells the failures
 *  apart: all four wrong is the prose, one or two right is the model being
 *  noisy, and a column that fails while the other lands is prose that describes
 *  a photograph rather than a setup. One candidate answers none of that. */
const PER_SUBJECT = 2

export interface Candidate {
  key: string
  slot: SubjectSlot
  status: 'idle' | 'running' | 'done' | 'failed'
  url: string | null
  error: string | null
}

function emptyGrid(): Array<Candidate> {
  return SUBJECT_SLOTS.flatMap(({ slot }) =>
    Array.from({ length: PER_SUBJECT }, (_, i) => ({
      key: `${slot}:${i}`,
      slot,
      status: 'idle' as const,
      url: null,
      error: null,
    })),
  )
}

export function useView() {
  const { user } = useAuth()
  const userImages = useUserImages(user.id)

  const [reference, setReference] = useState<Array<PickedImage>>([])
  const [subjects, setSubjects] = useState<PinnedSubjects>({})
  const [modelId, setModelId] = useState(defaultLightingModelId)

  const [name, setName] = useState('')
  const [setup, setSetup] = useState('')
  const [gels, setGels] = useState<Array<{ token: string; color: string }>>([])

  const [candidates, setCandidates] = useState<Array<Candidate>>(emptyGrid)
  /** Which tile represents the effect. It becomes the dialog's thumbnail, so
   *  picking one is part of saving rather than a separate opinion. */
  const [chosen, setChosen] = useState<string | null>(null)
  const [isDeriving, setIsDeriving] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState<SavedEffect | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The pinned pair is read once, client-side: it is localStorage, and a server
  // render has no access to it.
  useEffect(() => setSubjects(readSubjects()), [])

  const models = useMemo(() => {
    const allowed = new Set(lightingModelIds())
    return getModelsByCapability('sidebar').filter((m) => allowed.has(m.id))
  }, [])

  const pinSubject = useCallback((slot: SubjectSlot, picked?: PickedImage) => {
    setSubjects((current) => {
      const next = { ...current }
      if (picked) next[slot] = picked
      else delete next[slot]
      writeSubjects(next)
      return next
    })
  }, [])

  const derive = useCallback(async () => {
    const image = reference.at(0)
    if (!image) return
    setIsDeriving(true)
    setError(null)
    try {
      const effect = await deriveLightingEffect({ imageId: image.id })
      setName(effect.name)
      setSetup(effect.setup)
      setGels(effect.gels)
      // A grid from the previous setup beside prose that has been replaced is
      // the one thing that would make this page lie about what it tested.
      setCandidates(emptyGrid())
      setChosen(null)
      setSaved(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Derive failed')
    } finally {
      setIsDeriving(false)
    }
  }, [reference])

  const runOne = useCallback(
    async (key: string) => {
      const slot = key.split(':')[0] as SubjectSlot
      const subject = subjects[slot]
      if (!subject || !setup.trim()) return

      setCandidates((current) =>
        current.map((c) =>
          c.key === key
            ? { ...c, status: 'running', url: null, error: null }
            : c,
        ),
      )
      // A choice pointing at a tile that is being redrawn is a choice about a
      // picture nobody can see any more.
      setChosen((current) => (current === key ? null : current))
      try {
        const { url } = await renderLightingCandidate({
          subjectImageId: subject.id,
          setup,
          gels,
          modelId,
        })
        setCandidates((current) =>
          current.map((c) =>
            c.key === key ? { ...c, status: 'done', url, error: null } : c,
          ),
        )
      } catch (err) {
        setCandidates((current) =>
          current.map((c) =>
            c.key === key
              ? {
                  ...c,
                  status: 'failed',
                  url: null,
                  error: err instanceof Error ? err.message : 'Failed',
                }
              : c,
          ),
        )
      }
    },
    [subjects, setup, gels, modelId],
  )

  // All four at once. They are independent calls and the grid is judged whole,
  // so serialising them would only make the wait four times longer.
  const runAll = useCallback(() => {
    void Promise.all(emptyGrid().map((c) => runOne(c.key)))
  }, [runOne])

  const captured: CapturedEffect = useMemo(
    () => ({ id: slugify(name) || 'untitled', name: name.trim(), setup, gels }),
    [name, setup, gels],
  )

  const subjectsReady = SUBJECT_SLOTS.every(({ slot }) => !!subjects[slot])
  const estimate = useMemo(
    () =>
      estimateImageCostCents(
        [modelId],
        SUBJECT_SLOTS.length * PER_SUBJECT,
        true,
      ),
    [modelId],
  )

  const save = useCallback(async () => {
    const tile = candidates.find((c) => c.key === chosen)
    if (!tile?.url) return
    setIsSaving(true)
    setError(null)
    try {
      setSaved(
        await saveLightingEffect({
          name,
          setup,
          gels,
          thumbnailUrl: tile.url,
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [candidates, chosen, name, setup, gels])

  // Everything, not just the reference: leaving a derived setup on screen under
  // a cleared reference is the page describing a picture it is no longer
  // holding.
  const reset = useCallback(() => {
    setReference([])
    setName('')
    setSetup('')
    setGels([])
    setCandidates(emptyGrid())
    setChosen(null)
    setSaved(null)
    setError(null)
  }, [])

  return {
    userImages,
    reference,
    setReference,
    clearReference: useCallback(() => setReference([]), []),
    subjects,
    subjectsReady,
    pinSubject,
    models,
    modelId,
    setModelId,
    name,
    setName,
    setup,
    setSetup,
    gels,
    setGel: useCallback((token: string, color: string) => {
      setGels((current) =>
        current.map((g) => (g.token === token ? { ...g, color } : g)),
      )
    }, []),
    candidates,
    chosen,
    setChosen,
    saved,
    isSaving,
    save,
    reset,
    captured,
    estimate,
    isDeriving,
    isRunning: candidates.some((c) => c.status === 'running'),
    error,
    canDerive: reference.length > 0 && !isDeriving,
    canRun: subjectsReady && setup.trim().length > 0,
    canSave:
      !!chosen &&
      !!candidates.find((c) => c.key === chosen)?.url &&
      name.trim().length > 0 &&
      !isSaving,
    derive,
    runAll,
    runOne,
  }
}
