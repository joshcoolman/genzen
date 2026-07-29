'use client'

import { useEffect, useState } from 'react'
import styles from './toast.module.css'

/**
 * Minimal self-contained toast. Avoids a third-party toast lib (sonner) whose
 * CJS React interop breaks under this TanStack Start / Vite optimizeDeps setup.
 * Mount <Toaster /> once at the app root; call `toast(...)` from anywhere.
 * It is mounted in `app/(authenticated)/_components/app-shell/app-shell.tsx` --
 * for a long time it was mounted nowhere, so every `toast(...)` in the app ran
 * correctly and painted nothing (#192).
 *
 * The two halves are decoupled on purpose: `toast()` is called from hooks and
 * async callbacks that have no JSX, so it pushes onto a module-level array that
 * <Toaster /> subscribes to. The cost of that is exactly the bug above -- the
 * caller cannot tell whether anything is listening.
 */

type ToastVariant = 'default' | 'success' | 'error'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastOptions {
  duration?: number
  action?: ToastAction
  cancel?: ToastAction
  variant?: ToastVariant
}

interface ToastItem extends Required<
  Pick<ToastOptions, 'duration' | 'variant'>
> {
  id: number
  message: string
  action?: ToastAction
  cancel?: ToastAction
}

let toasts: Array<ToastItem> = []
let counter = 0
const listeners = new Set<(t: Array<ToastItem>) => void>()

function emit() {
  for (const l of listeners) l(toasts)
}

function remove(id: number) {
  toasts = toasts.filter((t) => t.id !== id)
  emit()
}

function add(message: string, opts: ToastOptions = {}): number {
  const id = ++counter
  const item: ToastItem = {
    id,
    message,
    variant: opts.variant ?? 'default',
    duration: opts.duration ?? 5000,
    action: opts.action,
    cancel: opts.cancel,
  }
  toasts = [...toasts, item]
  emit()
  if (item.duration !== Infinity) {
    setTimeout(() => remove(id), item.duration)
  }
  return id
}

interface ToastFn {
  (message: string, opts?: ToastOptions): number
  success: (message: string, opts?: ToastOptions) => number
  error: (message: string, opts?: ToastOptions) => number
  dismiss: (id: number) => void
}

export const toast = ((message: string, opts?: ToastOptions) =>
  add(message, opts)) as ToastFn
toast.success = (message, opts) => add(message, { ...opts, variant: 'success' })
toast.error = (message, opts) => add(message, { ...opts, variant: 'error' })
toast.dismiss = (id) => remove(id)

export function Toaster() {
  const [items, setItems] = useState<Array<ToastItem>>([])

  useEffect(() => {
    const l = (t: Array<ToastItem>) => setItems([...t])
    listeners.add(l)
    setItems([...toasts])
    return () => {
      listeners.delete(l)
    }
  }, [])

  return (
    <div className={styles.viewport}>
      {items.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${t.variant === 'default' ? '' : styles[t.variant]}`}
          role={t.variant === 'error' ? 'alert' : 'status'}
        >
          <span className={styles.message}>{t.message}</span>
          {(t.cancel || t.action) && (
            <div className={styles.buttons}>
              {t.cancel && (
                <button
                  type="button"
                  className={styles.cancel}
                  onClick={() => {
                    t.cancel!.onClick()
                    remove(t.id)
                  }}
                >
                  {t.cancel.label}
                </button>
              )}
              {t.action && (
                <button
                  type="button"
                  className={styles.action}
                  onClick={() => {
                    t.action!.onClick()
                    remove(t.id)
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
