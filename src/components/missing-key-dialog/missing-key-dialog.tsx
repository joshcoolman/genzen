'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { Key } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../dialog/dialog'
import { Button } from '../button/button'
import { toast } from '../toast/toast'
import styles from './missing-key-dialog.module.css'
import type { ReactNode } from 'react'
import type { MissingKeyInfo } from '#/lib/ai-keys'
import { parseMissingKey } from '#/lib/ai-keys'

interface MissingKeyContextValue {
  /**
   * Hand any caught error here. If it's a missing-provider-key failure the
   * dialog opens and this returns true; otherwise it toasts the message and
   * returns false, so no error is ever swallowed.
   */
  reportError: (err: unknown, fallback?: string) => boolean
}

const MissingKeyContext = createContext<MissingKeyContextValue | null>(null)

export function MissingKeyProvider({ children }: { children: ReactNode }) {
  const [missing, setMissing] = useState<MissingKeyInfo | null>(null)

  const reportError = useCallback((err: unknown, fallback?: string) => {
    const info = parseMissingKey(err)
    if (info) {
      setMissing(info)
      return true
    }
    const message =
      err instanceof Error && err.message
        ? err.message
        : typeof err === 'string' && err
          ? err
          : (fallback ?? 'Something went wrong.')
    toast(message, { variant: 'error', duration: 8000 })
    return false
  }, [])

  const value = useMemo(() => ({ reportError }), [reportError])

  return (
    <MissingKeyContext.Provider value={value}>
      {children}
      <Dialog
        open={missing !== null}
        onOpenChange={(open) => !open && setMissing(null)}
      >
        <DialogContent className={styles.popup}>
          <DialogHeader>
            <div className={styles.icon}>
              <Key className={styles.iconGlyph} />
            </div>
            <DialogTitle>{missing?.label} API key required</DialogTitle>
            <DialogDescription>
              This action runs on the server and needs your {missing?.label} API
              key. It isn't set, so nothing was run.
            </DialogDescription>
          </DialogHeader>

          <div className={styles.body}>
            <p className={styles.lead}>
              Add it to <code className={styles.code}>.env.local</code> and
              restart the dev server:
            </p>
            <pre className={styles.envVar}>{missing?.envVar}=...</pre>
          </div>

          <div className={styles.footer}>
            <Button variant="ghost" onClick={() => setMissing(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MissingKeyContext.Provider>
  )
}

/**
 * Falls back to a plain toast when used outside the provider, so a feature
 * rendered off the dashboard still reports its errors.
 */
export function useReportError(): MissingKeyContextValue['reportError'] {
  const ctx = useContext(MissingKeyContext)
  return useMemo(
    () =>
      ctx?.reportError ??
      ((err: unknown, fallback?: string) => {
        const message =
          err instanceof Error && err.message
            ? err.message
            : (fallback ?? 'Something went wrong.')
        toast(message, { variant: 'error', duration: 8000 })
        return false
      }),
    [ctx],
  )
}
