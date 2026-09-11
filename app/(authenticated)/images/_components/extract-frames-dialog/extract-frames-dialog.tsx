'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { MAX_FRAMES } from '../../_lib/frame-extraction'
import styles from './extract-frames-dialog.module.css'
import type { PointerEvent } from 'react'
import type { useExtractFrames } from './use-extract-frames'
import type { FrameRegion } from '../../_lib/frame-extraction'
import { imageUrl } from '#/lib/image-url'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from '#/components'

export function ExtractFramesDialog({
  extraction: state,
}: {
  extraction: ReturnType<typeof useExtractFrames>
}) {
  const drag = useRef<{
    id: string
    x: number
    y: number
    frame: FrameRegion
    resize: boolean
  } | null>(null)
  const active = state.frames.find((f) => f.id === state.activeId)
  const selected = state.frames.filter((f) => f.selected)
  const remaining = selected.filter((f) => !f.recordId).length
  const source = state.review
  function point(event: PointerEvent<SVGSVGElement>) {
    const matrix = event.currentTarget.getScreenCTM()!
    const mapped = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    )
    return { x: mapped.x, y: mapped.y }
  }
  return (
    <Dialog open={state.isOpen} onOpenChange={state.setOpen}>
      <DialogContent className={styles.popup}>
        <DialogHeader>
          <DialogTitle>Extract frames</DialogTitle>
        </DialogHeader>
        <p className={styles.note}>
          Review the frames before saving. Crops keep the source’s original
          detail. Automatic detection uses Claude.
        </p>
        {state.detecting && (
          <p role="status">
            Finding frames… You can close this window while detection runs.
          </p>
        )}
        {state.error && (
          <p role="alert" className={styles.error}>
            {state.error}
          </p>
        )}
        {!source && state.target && (
          <img
            className={styles.source}
            src={imageUrl(state.target.id)}
            alt={state.target.title}
          />
        )}
        {!source && !state.detecting && state.target && (
          <Button onClick={() => void state.open(state.target!)}>
            Try detection again
          </Button>
        )}
        {source && (
          <>
            <div className={styles.workspace}>
              <div className={styles.preview}>
                <svg
                  role="img"
                  aria-label="Source image with numbered frame boundaries"
                  viewBox={`0 0 ${source.width} ${source.height}`}
                  className={styles.overlay}
                  onPointerMove={(event) => {
                    const current = drag.current
                    if (!current || state.submitted) return
                    const p = point(event)
                    const dx = Math.round(p.x - current.x)
                    const dy = Math.round(p.y - current.y)
                    const f = current.frame
                    state.update(
                      current.id,
                      current.resize
                        ? {
                            width: Math.max(
                              1,
                              Math.min(source.width - f.left, f.width + dx),
                            ),
                            height: Math.max(
                              1,
                              Math.min(source.height - f.top, f.height + dy),
                            ),
                          }
                        : {
                            left: Math.max(
                              0,
                              Math.min(source.width - f.width, f.left + dx),
                            ),
                            top: Math.max(
                              0,
                              Math.min(source.height - f.height, f.top + dy),
                            ),
                          },
                    )
                  }}
                  onPointerUp={() => {
                    drag.current = null
                  }}
                  onPointerCancel={() => {
                    drag.current = null
                  }}
                  onPointerDown={(event) => {
                    const target = event.target as SVGElement
                    const id = target.getAttribute('data-frame')
                    const frame = state.frames.find((f) => f.id === id)
                    if (!frame || state.submitted) return
                    state.setActiveId(frame.id)
                    event.currentTarget.setPointerCapture(event.pointerId)
                    drag.current = {
                      id: frame.id,
                      ...point(event),
                      frame,
                      resize: target.getAttribute('data-resize') === 'true',
                    }
                  }}
                >
                  <image
                    href={imageUrl(source.sourceId)}
                    width={source.width}
                    height={source.height}
                  />
                  {state.frames.map((f, index) => (
                    <g
                      key={f.id}
                      className={!f.selected ? styles.excluded : undefined}
                    >
                      <rect
                        data-frame={f.id}
                        x={f.left}
                        y={f.top}
                        width={f.width}
                        height={f.height}
                        className={
                          f.id === state.activeId
                            ? styles.activeFrame
                            : styles.frame
                        }
                      />
                      <text
                        x={f.left + 8}
                        y={f.top + Math.max(20, source.width / 45)}
                        fontSize={Math.max(18, source.width / 45)}
                        className={styles.number}
                      >
                        {index + 1}
                      </text>
                      {f.id === state.activeId && !state.submitted && (
                        <rect
                          data-frame={f.id}
                          data-resize="true"
                          x={f.left + f.width - source.width / 65}
                          y={f.top + f.height - source.width / 65}
                          width={source.width / 65}
                          height={source.width / 65}
                          className={styles.handle}
                        />
                      )}
                    </g>
                  ))}
                </svg>
              </div>
              <div className={styles.controls}>
                {!state.frames.length && (
                  <p>
                    No separate panels found. Add a frame and set its boundary
                    if one was missed.
                  </p>
                )}
                <ol className={styles.frames}>
                  {state.frames.map((f, index) => (
                    <li key={f.id}>
                      <div className={styles.frameRow}>
                        <input
                          type="checkbox"
                          checked={f.selected}
                          disabled={state.submitted}
                          onChange={(e) =>
                            state.update(f.id, { selected: e.target.checked })
                          }
                          aria-label={`Include frame ${index + 1}`}
                        />
                        <button
                          type="button"
                          className={styles.selectFrame}
                          aria-pressed={f.id === state.activeId}
                          onClick={() => state.setActiveId(f.id)}
                        >
                          {index + 1}. {f.label}
                        </button>
                      </div>
                      {(state.saving && f.selected && !f.recordId) ||
                      f.recordId ||
                      f.error ? (
                        <p
                          role="status"
                          className={f.error ? styles.error : styles.note}
                        >
                          {f.recordId
                            ? 'Saved'
                            : state.saving
                              ? 'Saving…'
                              : f.error}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
                {active && (
                  <fieldset
                    disabled={state.submitted}
                    className={styles.bounds}
                  >
                    <legend>
                      Frame {state.frames.indexOf(active) + 1} boundary
                    </legend>
                    <p className={styles.note}>
                      Drag its outline or bottom-right handle, or enter pixels.
                    </p>
                    {(['left', 'top', 'width', 'height'] as const).map(
                      (key) => (
                        <label key={key}>
                          {key}
                          <Input
                            type="number"
                            aria-label={`Frame ${key}`}
                            min={key === 'left' || key === 'top' ? 0 : 1}
                            max={
                              key === 'left' || key === 'width'
                                ? source.width
                                : source.height
                            }
                            value={active[key]}
                            onChange={(e) => {
                              const value = Number(e.target.value)
                              if (Number.isInteger(value))
                                state.update(active.id, { [key]: value })
                            }}
                          />
                        </label>
                      ),
                    )}
                    <div className={styles.actions}>
                      <Button
                        size="sm"
                        disabled={state.frames.indexOf(active) === 0}
                        onClick={() => state.move(active.id, -1)}
                      >
                        Earlier
                      </Button>
                      <Button
                        size="sm"
                        disabled={
                          state.frames.indexOf(active) ===
                          state.frames.length - 1
                        }
                        onClick={() => state.move(active.id, 1)}
                      >
                        Later
                      </Button>
                    </div>
                  </fieldset>
                )}
                {!state.submitted && (
                  <Button
                    disabled={state.frames.length >= MAX_FRAMES}
                    onClick={state.add}
                  >
                    Add frame
                  </Button>
                )}
              </div>
            </div>
            {state.groupId && (
              <Link
                href={`/images?group=${state.groupId}`}
                onClick={() => state.setOpen(false)}
              >
                View saved frames
              </Link>
            )}
            <div className={styles.footer}>
              {state.submitted && !state.saving && (
                <Button onClick={() => void state.open(state.target!, true)}>
                  New review
                </Button>
              )}
              <p role="status">
                {selected.length} selected · {source.width} × {source.height}{' '}
                source
              </p>
              <Button
                variant="primary"
                disabled={state.saving || !remaining}
                onClick={() => void state.save()}
              >
                {state.saving
                  ? `Saving ${remaining} frames…`
                  : state.submitted
                    ? remaining
                      ? `Retry ${remaining} frames`
                      : 'Frames saved'
                    : `Extract ${selected.length} frames`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
