import { useEffect, useState } from 'react'

/**
 * Minimal self-contained toast. Avoids a third-party toast lib (sonner) whose
 * CJS React interop breaks under this TanStack Start / Vite optimizeDeps setup.
 * Mount <Toaster /> once at the app root; call `toast(...)` from anywhere.
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

const ACCENT: Record<ToastVariant, string> = {
  default: '#2a2a2a',
  success: '#1f7a3d',
  error: '#a33',
}

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
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {items.map((t) => (
        <div
          key={t.id}
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            minWidth: 280,
            maxWidth: 420,
            background: '#141414',
            border: `1px solid ${ACCENT[t.variant]}`,
            borderRadius: 10,
            padding: '12px 14px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
            color: '#eee',
            fontSize: 13,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <span style={{ flex: 1 }}>{t.message}</span>
          {(t.cancel || t.action) && (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {t.cancel && (
                <button
                  style={{
                    background: '#222',
                    border: '1px solid #333',
                    borderRadius: 6,
                    color: '#bbb',
                    fontSize: 12,
                    padding: '5px 10px',
                    cursor: 'pointer',
                  }}
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
                  style={{
                    background: '#fff',
                    border: '1px solid #fff',
                    borderRadius: 6,
                    color: '#111',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '5px 10px',
                    cursor: 'pointer',
                  }}
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
