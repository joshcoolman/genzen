'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import { Key } from 'lucide-react'
import type { ReactNode } from 'react'
import type { MissingKeyInfo } from '@/lib/ai-keys'
import { parseMissingKey } from '@/lib/ai-keys'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'

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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Key className="h-5 w-5 text-muted-foreground" />
            </div>
            <DialogTitle>{missing?.label} API key required</DialogTitle>
            <DialogDescription>
              This action runs on the server and needs your {missing?.label} API
              key. It isn't set, so nothing was run.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Add it to <code className="text-foreground">.env.local</code> and
              restart the dev server:
            </p>
            <pre className="overflow-x-auto rounded border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">
              {missing?.envVar}=...
            </pre>
            {missing?.provider === 'anthropic' && (
              <p className="text-xs text-muted-foreground">
                The key you may have entered in the AD panel is a separate,
                browser-only key — it is deliberately never sent to the server,
                so it can't be used here.
              </p>
            )}
          </div>

          <div className="flex justify-end">
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
