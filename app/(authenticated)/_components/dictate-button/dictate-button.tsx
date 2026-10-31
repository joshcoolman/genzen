'use client'

import { LoaderCircle, Mic, Square } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import styles from './dictate-button.module.css'
import { toast } from '#/components'
import { transcribeAudio } from '#/lib/server/fal/transcribe.action'
import { cx } from '#/lib/utils'

type Phase = 'idle' | 'recording' | 'transcribing'

/** A prompt is a few sentences. Past this the recorder stops itself, so a
 *  button left on in a pocket does not record for an hour. */
const MAX_RECORDING_MS = 5 * 60 * 1000

/** Chrome and Firefox record webm; Safari only mp4. Whisper takes either. */
function pickMimeType(): string | undefined {
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'])
    if (MediaRecorder.isTypeSupported(type)) return type
  return undefined
}

/** Spoken text joins what is already typed, after a space. */
export function appendSpoken(current: string, spoken: string): string {
  const head = current.trimEnd()
  return head ? `${head} ${spoken}` : spoken
}

function canRecord() {
  return (
    typeof navigator !== 'undefined' &&
    // Absent on an insecure origin, whatever the types say.
    'mediaDevices' in navigator &&
    typeof MediaRecorder !== 'undefined'
  )
}

const noop = () => () => {}

/**
 * Speak a prompt (#811): tap to record, tap again to stop, and the words are
 * handed to `onText`. Sits in the bottom-right corner of a prompt field; the
 * parent positions it.
 *
 * Record-then-transcribe rather than the browser's own speech recognition,
 * which is unreliable in iPhone Safari and missing in Firefox. The cost is
 * that the words arrive when you stop, not as you speak.
 *
 * Renders nothing where the browser cannot record (an insecure origin, an old
 * browser), rather than a button that fails on tap.
 */
export function DictateButton({
  onText,
  disabled,
  className,
}: {
  onText: (text: string) => void
  disabled?: boolean
  className?: string
}) {
  const supported = useSyncExternalStore(noop, canRecord, () => false)
  const [phase, setPhase] = useState<Phase>('idle')
  const recorder = useRef<MediaRecorder | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The latest callback, so text lands against what the field holds when the
  // transcript arrives rather than when recording started.
  const onTextRef = useRef(onText)
  useEffect(() => {
    onTextRef.current = onText
  })

  // Leaving mid-recording releases the microphone without transcribing.
  useEffect(
    () => () => {
      const rec = recorder.current
      if (!rec) return
      rec.onstop = null
      if (rec.state !== 'inactive') rec.stop()
      rec.stream.getTracks().forEach((t) => t.stop())
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  if (!supported) return null

  async function start() {
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      toast.error('Microphone access was blocked.')
      return
    }
    const mimeType = pickMimeType()
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: Array<Blob> = []
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      if (timer.current) clearTimeout(timer.current)
      recorder.current = null
      const type = rec.mimeType || mimeType || 'audio/webm'
      void transcribe(new Blob(chunks, { type }))
    }
    recorder.current = rec
    rec.start()
    setPhase('recording')
    timer.current = setTimeout(() => stop(), MAX_RECORDING_MS)
  }

  function stop() {
    const rec = recorder.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }

  async function transcribe(audio: Blob) {
    if (audio.size === 0) {
      setPhase('idle')
      return
    }
    setPhase('transcribing')
    const ext = audio.type.includes('mp4') ? 'm4a' : 'webm'
    const form = new FormData()
    form.append('audio', audio, `prompt.${ext}`)
    try {
      const result = await transcribeAudio(form)
      if (result.ok) onTextRef.current(result.text)
      else toast.error(result.error)
    } catch {
      toast.error('Transcription failed. Try again.')
    } finally {
      setPhase('idle')
    }
  }

  const label =
    phase === 'recording'
      ? 'Stop and transcribe'
      : phase === 'transcribing'
        ? 'Transcribing'
        : 'Speak a prompt'

  return (
    <button
      type="button"
      className={cx(
        styles.root,
        phase === 'recording' && styles.recording,
        className,
      )}
      aria-label={label}
      title={label}
      aria-pressed={phase === 'recording'}
      disabled={phase === 'transcribing' || (disabled && phase === 'idle')}
      onClick={() => (phase === 'recording' ? stop() : void start())}
    >
      {phase === 'recording' ? (
        <Square />
      ) : phase === 'transcribing' ? (
        <LoaderCircle className={styles.spin} />
      ) : (
        <Mic />
      )}
    </button>
  )
}
