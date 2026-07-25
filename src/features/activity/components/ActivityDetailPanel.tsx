import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock4,
  Copy,
  Image as ImageIcon,
} from 'lucide-react'
import { getActivityEntry } from '../server/get-activity-entry.server'
import type { ActivityEntryDetail } from '../types'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useAuth } from '@/lib/auth'
import {
  formatAbsolute,
  formatDurationMs,
  formatRelativeOrDate,
} from '@/lib/time-format'
import { cn } from '@/lib/utils'

interface ActivityDetailPanelProps {
  entryId: string | null
  onClose: () => void
  getThumbUrl: (path: string | null) => string | null
}

function StatusBadge({ status }: { status: ActivityEntryDetail['status'] }) {
  const styles = {
    completed: 'bg-emerald-500/10 text-emerald-500',
    failed: 'bg-destructive/10 text-destructive',
    pending: 'bg-muted text-muted-foreground',
  } as const
  const labels = {
    completed: 'Completed',
    failed: 'Failed',
    pending: 'Pending',
  } as const
  const Icon = {
    completed: CheckCircle2,
    failed: AlertCircle,
    pending: Clock4,
  }[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium',
        styles[status],
      )}
    >
      <Icon className="h-3 w-3" />
      {labels[status]}
    </span>
  )
}

function formatCents(cents: number | null, isEstimate = false): string {
  if (cents == null) return '—'
  const prefix = isEstimate ? '~' : ''
  const dollars = cents / 100
  if (dollars === 0) return `${prefix}$0.00`
  if (dollars < 0.01) return `${prefix}$${dollars.toFixed(4)}`
  if (dollars < 1) return `${prefix}$${dollars.toFixed(3)}`
  return `${prefix}$${dollars.toFixed(2)}`
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function DetailRow({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          'min-w-0 break-all text-right text-foreground',
          mono && 'font-mono text-[11px]',
        )}
      >
        {children}
      </span>
    </div>
  )
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      title={label}
      aria-label={label}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="rounded-md border border-border bg-card/40 px-3 py-2">
        {children}
      </div>
    </div>
  )
}

// Token regex captures: string-with-trailing-colon (key), bare string,
// number, boolean/null, punctuation, whitespace. The optional `(\s*:)`
// lookahead distinguishes object keys from string values.
const JSON_TOKEN_RE =
  /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],:])/g

function highlightJson(json: string): Array<React.ReactNode> {
  const out: Array<React.ReactNode> = []
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = JSON_TOKEN_RE.exec(json)) !== null) {
    if (m.index > last) out.push(json.slice(last, m.index))
    const str = m[1] as string | undefined
    const colon = m[2] as string | undefined
    const num = m[3] as string | undefined
    const lit = m[4] as string | undefined
    const punct = m[5] as string | undefined
    if (str !== undefined) {
      if (colon !== undefined) {
        out.push(
          <span key={key++} className="text-rose-400">
            {str}
          </span>,
        )
        out.push(colon)
      } else {
        out.push(
          <span key={key++} className="text-emerald-400">
            {str}
          </span>,
        )
      }
    } else if (num !== undefined) {
      out.push(
        <span key={key++} className="text-amber-400">
          {num}
        </span>,
      )
    } else if (lit !== undefined) {
      out.push(
        <span key={key++} className="text-sky-400">
          {lit}
        </span>,
      )
    } else if (punct !== undefined) {
      out.push(punct)
    }
    last = JSON_TOKEN_RE.lastIndex
  }
  if (last < json.length) out.push(json.slice(last))
  return out
}

function JsonBlock({ json }: { json: string }) {
  return (
    <pre className="max-h-[40vh] overflow-auto rounded bg-muted/40 p-2 text-[11px] leading-relaxed text-foreground">
      <code className="font-mono">{highlightJson(json)}</code>
    </pre>
  )
}

export function ActivityDetailPanel({
  entryId,
  onClose,
  getThumbUrl,
}: ActivityDetailPanelProps) {
  const { session } = useAuth()
  const accessToken = session?.access_token
  const [detail, setDetail] = useState<ActivityEntryDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = entryId != null

  useEffect(() => {
    if (!entryId || !accessToken) {
      setDetail(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getActivityEntry({ data: { accessToken, id: entryId } })
      .then((result) => {
        if (cancelled) return
        setDetail(result)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [entryId, accessToken])

  const thumbUrl = detail ? getThumbUrl(detail.thumbnailPath) : null

  return (
    <>
      {/* Large preview rendered in the dim area to the left of the sheet.
          pointer-events-none so clicks pass through to the overlay (close). */}
      {open && detail && thumbUrl && (
        <div className="pointer-events-none fixed inset-y-0 left-0 right-0 z-[51] hidden items-center justify-center p-12 sm:right-[28rem] sm:flex">
          <img
            src={thumbUrl}
            alt=""
            className="max-h-[90vh] max-w-full rounded-md object-contain shadow-2xl"
          />
        </div>
      )}
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <SheetHeader className="space-y-3 border-b border-border px-4 py-4">
            <SheetTitle className="text-sm">Generation</SheetTitle>
            {detail && (
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded bg-black">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted/50">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    {detail.modelName}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={detail.status} />
                    {detail.isDeleted && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        deleted
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {isLoading && (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Loading…
              </div>
            )}
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            {!isLoading && !error && detail && (
              <>
                {detail.prompt && (
                  <Section title="Prompt">
                    <div className="relative">
                      <p className="whitespace-pre-wrap pr-7 text-xs leading-relaxed text-foreground">
                        {detail.prompt}
                      </p>
                      <CopyButton text={detail.prompt} label="Copy prompt" />
                    </div>
                  </Section>
                )}

                {detail.errorMessage && (
                  <Section title="Error">
                    <div className="relative">
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all pr-7 font-mono text-[11px] leading-relaxed text-destructive">
                        {detail.errorMessage}
                      </pre>
                      <CopyButton
                        text={detail.errorMessage}
                        label="Copy error"
                      />
                    </div>
                  </Section>
                )}

                <Section title="Details">
                  {detail.provider && (
                    <DetailRow label="Provider">{detail.provider}</DetailRow>
                  )}
                  <DetailRow label="Duration">
                    {detail.durationMs != null
                      ? formatDurationMs(detail.durationMs)
                      : '—'}
                  </DetailRow>
                  <DetailRow label="Cost">
                    {formatCents(
                      detail.providerCostCents,
                      detail.costIsEstimate,
                    )}
                    {detail.costIsEstimate &&
                      detail.providerCostCents != null && (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">
                          estimated
                        </span>
                      )}
                  </DetailRow>
                  <DetailRow label="Created">
                    <span title={formatAbsolute(detail.createdAt)}>
                      {formatRelativeOrDate(detail.createdAt)}
                    </span>
                  </DetailRow>
                  <DetailRow label="Size">
                    {formatBytes(detail.fileSize)}
                  </DetailRow>
                  <DetailRow label="Dimensions">
                    {detail.width && detail.height
                      ? `${detail.width} × ${detail.height}`
                      : '—'}
                  </DetailRow>
                  <DetailRow label="MIME">{detail.mimeType ?? '—'}</DetailRow>
                </Section>

                {detail.referenceImages.length > 0 && (
                  <Section
                    title={`References (${detail.referenceImages.length})`}
                  >
                    <div className="grid grid-cols-4 gap-2">
                      {detail.referenceImages.map((ref) => {
                        const url = getThumbUrl(ref.storagePath)
                        return (
                          <div
                            key={ref.id}
                            className="relative aspect-square overflow-hidden rounded bg-black"
                            title={ref.id}
                          >
                            {url ? (
                              <img
                                src={url}
                                alt=""
                                className={cn(
                                  'h-full w-full object-cover',
                                  ref.isDeleted && 'opacity-40',
                                )}
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                                missing
                              </div>
                            )}
                            {ref.isDeleted && (
                              <span className="absolute bottom-0.5 left-0.5 rounded bg-background/80 px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                                del
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </Section>
                )}

                <Section title="Raw metadata">
                  <JsonBlock json={detail.rawMetadataJson} />
                </Section>
              </>
            )}
            {!isLoading && !error && !detail && entryId && (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Not found.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
