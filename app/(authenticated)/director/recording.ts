export interface SavedTake {
  id: string
  startedAt: number
  mimeType: string
  blob: Blob
  complete: boolean
}

function database(owner: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(`genzen-director-v1-${owner}`, 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('takes'))
        request.result.createObjectStore('takes', { keyPath: 'id' })
      if (!request.result.objectStoreNames.contains('session'))
        request.result.createObjectStore('session')
    }
    request.onblocked = () =>
      reject(
        new Error('Close other Director tabs to restore local recordings.'),
      )
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(new Error('Local recording storage is unavailable.'))
  })
}

export async function readInitialImage(owner: string): Promise<File | null> {
  const db = await database(owner)
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction('session')
        .objectStore('session')
        .get('initial-image')
      request.onsuccess = () =>
        resolve(request.result instanceof File ? request.result : null)
      request.onerror = () =>
        reject(new Error('Could not restore the initial image.'))
    })
  } finally {
    db.close()
  }
}

export async function saveInitialImage(
  owner: string,
  file: File | null,
): Promise<void> {
  const db = await database(owner)
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('session', 'readwrite')
      const store = transaction.objectStore('session')
      if (file) store.put(file, 'initial-image')
      else store.delete('initial-image')
      transaction.oncomplete = () => resolve()
      transaction.onabort = transaction.onerror = () =>
        reject(new Error('Could not save the initial image locally.'))
    })
  } finally {
    db.close()
  }
}

/** Called only after an explicit Clear session confirmation and after all
 * recorder writes have drained, so a late checkpoint cannot recreate a take. */
export async function clearLocalSession(owner: string): Promise<void> {
  const db = await database(owner)
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(['takes', 'session'], 'readwrite')
      transaction.objectStore('takes').clear()
      transaction.objectStore('session').clear()
      transaction.oncomplete = () => resolve()
      transaction.onabort = transaction.onerror = () =>
        reject(new Error('Could not clear the local session.'))
    })
  } finally {
    db.close()
  }
}

export async function storeTake(owner: string, take: SavedTake): Promise<void> {
  const db = await database(owner)
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('takes', 'readwrite')
      transaction.objectStore('takes').put(take)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () =>
        reject(
          new Error(
            'Could not checkpoint this recording. Download it before leaving.',
          ),
        )
      transaction.onabort = () =>
        reject(new Error('Recording checkpoint was interrupted.'))
    })
  } finally {
    db.close()
  }
}

export async function listTakes(owner: string): Promise<Array<SavedTake>> {
  const db = await database(owner)
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('takes').objectStore('takes').getAll()
      request.onsuccess = () => resolve(request.result as Array<SavedTake>)
      request.onerror = () =>
        reject(new Error('Could not read local recordings.'))
    })
  } finally {
    db.close()
  }
}

/** Record received tracks directly. Muting the player never changes this
 * stream. The browser performs an encode; this is not a source-quality master. */
export class TakeRecorder {
  readonly id = crypto.randomUUID()
  private chunks: Array<Blob> = []
  private recorder: MediaRecorder
  private writes = Promise.resolve()
  private startedAt = Date.now()
  private stopping?: Promise<SavedTake>

  constructor(
    stream: MediaStream,
    private onError: (message: string) => void,
    private save: (take: SavedTake) => Promise<void>,
  ) {
    const mimeType = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/mp4',
    ].find((type) => MediaRecorder.isTypeSupported(type))
    if (!mimeType)
      throw new Error(
        'This browser cannot record Director video. Try a current desktop browser.',
      )
    this.recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 4_000_000,
      audioBitsPerSecond: 128_000,
    })
    this.recorder.ondataavailable = (event) => {
      if (!event.data.size) return
      this.chunks.push(event.data)
      // Queue checkpoints so an older write never replaces a finalized take.
      const take = this.snapshot(false)
      this.writes = this.writes
        .then(() => this.save(take))
        .catch((error: unknown) => {
          this.onError(
            error instanceof Error
              ? error.message
              : 'Recording checkpoint failed.',
          )
        })
    }
    this.recorder.onerror = () =>
      this.onError(
        'Recording failed. Any captured footage is available under Local takes.',
      )
    this.recorder.start(2_000)
  }

  private snapshot(complete: boolean): SavedTake {
    return {
      id: this.id,
      startedAt: this.startedAt,
      mimeType: this.recorder.mimeType,
      blob: new Blob(this.chunks, { type: this.recorder.mimeType }),
      complete,
    }
  }

  stop(): Promise<SavedTake> {
    if (this.stopping) return this.stopping
    this.stopping = new Promise((resolve) => {
      const finish = async () => {
        const take = this.snapshot(true)
        await this.writes
        try {
          await this.save(take)
        } catch {
          this.onError(
            'Local save failed. Download the recording before leaving.',
          )
        }
        resolve(take)
      }
      if (this.recorder.state === 'inactive') {
        void finish()
        return
      }
      this.recorder.addEventListener(
        'stop',
        () => {
          void finish()
        },
        { once: true },
      )
      this.recorder.stop()
    })
    return this.stopping
  }
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
