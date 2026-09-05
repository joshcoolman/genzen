import { latestJoin, nextIndex } from './clips'

export interface PlaybackClip {
  id: string
  url: string
}
/** The playing element is pinned until a boundary. Appends and replacements
 * only change the idle element; they never seek/reload the visible footage. */
export class CutPlayback {
  private clips: Array<PlaybackClip> = []
  private active = 0
  private index = -1
  private paused = false
  private revision = 0
  private waiting: (() => void) | undefined
  private transitioning = false

  constructor(
    private videos: [HTMLVideoElement, HTMLVideoElement],
    private changed: (active: number, index: number, paused: boolean) => void,
    private failed: (message: string) => void,
  ) {
    videos.forEach((video, slot) => {
      video.muted = true
      video.onended = () => {
        if (slot === this.active) this.next()
      }
      video.onerror = () =>
        this.failed(
          'A clip could not play. Try Next clip or reload the saved cut.',
        )
    })
  }

  setClips(clips: Array<PlaybackClip>) {
    this.clips = clips
    if (!clips.length) {
      this.cancelWait()
      this.index = -1
      this.videos.forEach((video) => {
        video.pause()
        video.removeAttribute('src')
        video.load()
      })
      this.changed(this.active, this.index, this.paused)
    } else if (this.index < 0) this.go(0)
    else if (this.transitioning) this.go(nextIndex(this.index, clips.length))
    else this.preload()
  }
  private load(video: HTMLVideoElement, url: string) {
    if (video.getAttribute('src') !== url) {
      video.src = url
      video.load()
    }
  }
  private preload() {
    const clip = this.clips.at(nextIndex(this.index, this.clips.length))
    if (!clip) return
    const idle = this.videos[1 - this.active]
    idle.pause()
    this.load(idle, clip.url)
    if (idle.readyState >= 1) idle.currentTime = 0
  }
  private cancelWait() {
    ++this.revision
    this.waiting?.()
    this.waiting = undefined
    this.transitioning = false
  }
  private go(index: number, tail = false) {
    const clip = this.clips.at(index)
    if (!clip) return
    this.cancelWait()
    this.transitioning = true
    const revision = this.revision
    const slot = 1 - this.active
    const next = this.videos[slot]
    next.pause()
    this.load(next, clip.url)
    let positioned = false
    const finish = () => {
      if (revision !== this.revision || next.readyState < 2) return
      if (!positioned) {
        positioned = true
        const at =
          tail && Number.isFinite(next.duration)
            ? Math.max(0, next.duration - 2)
            : 0
        if (Math.abs(next.currentTime - at) > 0.01) {
          next.currentTime = at
          return
        }
      }
      if (next.seeking) return
      this.waiting?.()
      this.waiting = undefined
      this.videos[this.active].pause()
      this.active = slot
      this.index = index
      this.transitioning = false
      this.changed(slot, index, this.paused)
      if (!this.paused) this.play(next)
      this.preload()
    }
    next.addEventListener('canplay', finish)
    next.addEventListener('seeked', finish)
    this.waiting = () => {
      next.removeEventListener('canplay', finish)
      next.removeEventListener('seeked', finish)
    }
    finish()
  }
  private play(video: HTMLVideoElement) {
    void video.play().catch((cause: unknown) => {
      if (cause instanceof DOMException && cause.name === 'AbortError') return
      this.paused = true
      this.changed(this.active, this.index, true)
      this.failed('Playback was paused by the browser. Press Play to continue.')
    })
  }
  next() {
    this.go(nextIndex(this.index, this.clips.length))
  }
  previous() {
    this.go(Math.max(0, this.index - 1))
  }
  latest() {
    this.go(latestJoin(this.clips.length), this.clips.length > 1)
  }
  toggle() {
    this.paused = !this.paused
    const video = this.videos[this.active]
    if (this.paused) video.pause()
    else this.play(video)
    this.changed(this.active, this.index, this.paused)
  }
  dispose() {
    this.cancelWait()
    this.videos.forEach((video) => {
      video.onended = video.onerror = null
      video.pause()
      video.removeAttribute('src')
      video.load()
    })
  }
}
