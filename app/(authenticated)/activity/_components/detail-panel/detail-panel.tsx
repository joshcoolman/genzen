'use client'

import { useEffect, useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock4,
  Copy,
  Image as ImageIcon,
} from 'lucide-react'
import { clsx } from 'clsx'
import { getActivityEntry } from '../../_actions/get-entry'
import styles from './detail-panel.module.css'
import type { ActivityEntryDetail } from '#/features/activity/types'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '#/components'
import {
  formatAbsolute,
  formatDurationMs,
  formatRelativeOrDate,
} from '#/lib/time-format'

interface DetailPanelProps {
  entryId: string | null
  onClose: () => void
  getThumbUrl: (path: string | null) => string | null
}

function StatusBadge({ status }: { status: ActivityEntryDetail['status'] }) {
  const variants = {
    completed: styles.badgeCompleted,
    failed: styles.badgeFailed,
    pending: styles.badgePending,
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
    <span className={`${styles.badge} ${variants[status]}`}>
      <Icon className={styles.badgeIcon} />
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
    <div className={styles.detailRow}>
      <span className={styles.detailLabel}>{label}</span>
      <span
        className={clsx(styles.detailValue, mono && styles.detailValueMono)}
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
      className={styles.copy}
      title={label}
      aria-label={label}
    >
      {copied ? (
        <Check className={`${styles.copyIcon} ${styles.copyIconDone}`} />
      ) : (
        <Copy className={styles.copyIcon} />
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
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <div className={styles.sectionBody}>{children}</div>
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
          <span key={key++} className={styles.jsonKey}>
            {str}
          </span>,
        )
        out.push(colon)
      } else {
        out.push(
          <span key={key++} className={styles.jsonString}>
            {str}
          </span>,
        )
      }
    } else if (num !== undefined) {
      out.push(
        <span key={key++} className={styles.jsonNumber}>
          {num}
        </span>,
      )
    } else if (lit !== undefined) {
      out.push(
        <span key={key++} className={styles.jsonLiteral}>
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
    <pre className={styles.json}>
      <code className={styles.jsonCode}>{highlightJson(json)}</code>
    </pre>
  )
}

export function DetailPanel({
  entryId,
  onClose,
  getThumbUrl,
}: DetailPanelProps) {
  const [detail, setDetail] = useState<ActivityEntryDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const open = entryId != null

  useEffect(() => {
    if (!entryId) {
      setDetail(null)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    getActivityEntry({ id: entryId })
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
  }, [entryId])

  const thumbUrl = detail ? getThumbUrl(detail.thumbnailPath) : null

  return (
    <>
      {/* Large preview rendered in the dim area to the left of the sheet.
          pointer-events-none so clicks pass through to the overlay (close). */}
      {open && detail && thumbUrl && (
        <div className={styles.preview}>
          <img src={thumbUrl} alt="" className={styles.previewImage} />
        </div>
      )}
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className={styles.sheet}>
          <SheetHeader className={styles.sheetHeader}>
            <SheetTitle className={styles.sheetTitle}>Generation</SheetTitle>
            {detail && (
              <div className={styles.summary}>
                <div className={styles.thumb}>
                  {thumbUrl ? (
                    <img src={thumbUrl} alt="" className={styles.thumbImage} />
                  ) : (
                    <div className={styles.thumbFallback}>
                      <ImageIcon className={styles.thumbIcon} />
                    </div>
                  )}
                </div>
                <div className={styles.summaryBody}>
                  <div className={styles.summaryName}>{detail.modelName}</div>
                  <div className={styles.summaryMeta}>
                    <StatusBadge status={detail.status} />
                    {detail.isDeleted && (
                      <span className={styles.deletedTag}>deleted</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </SheetHeader>

          <div className={styles.body}>
            {isLoading && <div className={styles.state}>Loading…</div>}
            {error && <div className={styles.error}>{error}</div>}
            {!isLoading && !error && detail && (
              <>
                {detail.prompt && (
                  <Section title="Prompt">
                    <div className={styles.copyWrap}>
                      <p className={styles.prompt}>{detail.prompt}</p>
                      <CopyButton text={detail.prompt} label="Copy prompt" />
                    </div>
                  </Section>
                )}

                {detail.errorMessage && (
                  <Section title="Error">
                    <div className={styles.copyWrap}>
                      <pre className={styles.errorText}>
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
                        <span className={styles.estimated}>estimated</span>
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
                    <div className={styles.refGrid}>
                      {detail.referenceImages.map((ref) => {
                        const url = getThumbUrl(ref.storagePath)
                        return (
                          <div
                            key={ref.id}
                            className={styles.ref}
                            title={ref.id}
                          >
                            {url ? (
                              <img
                                src={url}
                                alt=""
                                className={clsx(
                                  styles.refImage,
                                  ref.isDeleted && styles.refImageDeleted,
                                )}
                              />
                            ) : (
                              <div className={styles.refMissing}>missing</div>
                            )}
                            {ref.isDeleted && (
                              <span className={styles.refDeletedTag}>del</span>
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
              <div className={styles.state}>Not found.</div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
