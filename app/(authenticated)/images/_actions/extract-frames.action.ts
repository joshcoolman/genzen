'use server'

import {
  detectFramesInternal,
  extractFramesInternal,
} from '../_lib/extract-frames.server'
import type { FrameRegion } from '../_lib/frame-extraction'

export async function detectImageFrames(sourceId: string) {
  try {
    return { data: await detectFramesInternal(sourceId), error: null }
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : 'Frame detection failed. Try again.',
    }
  }
}
export async function extractImageFrames(input: {
  sourceId: string
  sourceHash: string
  batchId: string
  frames: Array<FrameRegion>
}) {
  try {
    return { data: await extractFramesInternal(input), error: null }
  } catch (error) {
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : 'Frame extraction failed. Try again.',
    }
  }
}
