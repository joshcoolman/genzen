import { Check, ExternalLink, Minus, X } from 'lucide-react'
import styles from './endpoint-report.module.css'
import type { ParsedEndpoint, ParsedField } from '../../parse-schema'
import { ActionButton, Badge, IconButton } from '#/components'
import { cx } from '#/lib/utils'

/**
 * What a field's control would be, in one line.
 *
 * The ranges and enum sizes are the point, not decoration -- "one of 2" says a
 * dropdown exists, "one of 21" says Topaz offers twenty-one upscaling models
 * and a row of pills is the wrong shape for it. Reading that off the report is
 * how the real controls get designed without guessing.
 */
function describeField(field: ParsedField): string {
  // A skipped field says "defaults to ..." in the next cell; a dash beside that
  // is a placeholder for a control nobody is waiting for.
  if (!field.kind) return field.skipped ? '' : '--'

  switch (field.kind) {
    case 'media':
      return `${field.mediaKind}${field.multiple ? `s${field.maxItems ? ` (up to ${field.maxItems})` : ''}` : ''}`
    case 'group':
      return field.multiple
        ? `repeats: ${field.fields?.length ?? 0} fields`
        : `${field.fields?.length ?? 0} fields`
    case 'enum':
      return `one of ${field.enumValues?.length ?? 0}`
    case 'number': {
      const { min, max } = field
      if (min !== undefined && max !== undefined) return `number ${min}-${max}`
      if (min !== undefined) return `number, min ${min}`
      if (max !== undefined) return `number, max ${max}`
      return 'number'
    }
    case 'boolean':
      return 'on / off'
    case 'textarea':
      return 'long text'
    case 'text':
      return 'text'
  }
}

/**
 * One field, and a group's members under it.
 *
 * Nested rather than flattened with a dotted name: `elements` repeating four
 * fields is one control to build, and a flat list of `elements.voice_id` would
 * read as four. The indent is the only thing saying "these come as a set".
 */
function FieldRow({ field }: { field: ParsedField }) {
  const blocking = !field.kind && !field.skipped

  return (
    <li
      className={cx(
        styles.field,
        blocking && styles.fieldBad,
        field.skipped && styles.fieldSkipped,
      )}
    >
      <span className={styles.row}>
        {/* A dash for a skipped field, not a cross. It is not a failure -- the
            endpoint works without it and the model has a stated default. A red
            cross beside a green Supported badge would read as a contradiction. */}
        <span className={styles.mark} aria-hidden="true">
          {field.kind ? (
            <Check size={14} />
          ) : field.skipped ? (
            <Minus size={14} />
          ) : (
            <X size={14} />
          )}
        </span>
        <code className={styles.fieldName}>{field.name}</code>
        <span className={styles.fieldKind}>
          {describeField(field)}
          {/* Muted, after the description, rather than a mark on the name. A
              red asterisk beside a green tick reads as two verdicts about the
              same field when only one of them is a verdict at all. */}
          {field.required && <span className={styles.req}>required</span>}
        </span>
        {field.skipped ? (
          // Still printed, with what it will get. Hiding it would be the
          // silence the strict rule existed to avoid.
          <span className={styles.fieldSkip}>
            not drawable &mdash; defaults to {formatDefault(field.defaultValue)}
          </span>
        ) : (
          field.reason && (
            <span className={styles.fieldReason}>{field.reason}</span>
          )
        )}
      </span>
      {field.fields && (
        <ul className={styles.nested}>
          {field.fields.map((inner) => (
            <FieldRow key={inner.name} field={inner} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** A default as one short line. Objects are the interesting case: Seedream's
 *  `image_size` defaults to `{ width: 2048, height: 2048 }`. */
function formatDefault(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value)
      .map(([k, v]) => `${k} ${String(v)}`)
      .join(' \u00d7 ')
  }
  return JSON.stringify(value)
}

export function EndpointReport({
  report,
  sourceUrl,
  saved,
  saving,
  onSave,
  onRemove,
}: {
  report: ParsedEndpoint
  sourceUrl: string
  /** In the rail already. Swaps Save for Remove -- the two are never both on. */
  saved: boolean
  saving: boolean
  onSave: () => void
  onRemove: () => void
}) {
  const drawable = report.fields.filter((f) => f.kind).length

  return (
    <article
      className={cx(styles.card, !report.supported && styles.cardUnsupported)}
    >
      <header className={styles.head}>
        <div className={styles.identity}>
          <code className={styles.endpointId}>{report.endpointId}</code>
          <p className={styles.title}>{report.title}</p>
        </div>
        <div className={styles.actions}>
          <Badge
            className={report.supported ? styles.badgeOk : styles.badgeBad}
          >
            {report.supported ? 'Supported' : 'Not supported'}
          </Badge>
          {/* An anchor, not a button that calls `window.open`: the way back to
              the model page is a link, and a link is middle-clickable. */}
          <a
            className={styles.external}
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open on fal.ai"
            title="Open on fal.ai"
          >
            <ExternalLink size={15} />
          </a>
          {saved ? (
            <IconButton aria-label="Remove endpoint" onClick={onRemove}>
              <X size={15} />
            </IconButton>
          ) : (
            // Save is offered for a refusal too. "We cannot draw this yet" is
            // worth coming back to -- re-checking it once the parser has
            // learned something is most of why the rail exists.
            <ActionButton
              variant="outline"
              loading={saving}
              loadingText="Saving"
              onClick={onSave}
            >
              Save
            </ActionButton>
          )}
        </div>
      </header>

      <dl className={styles.summary}>
        <div>
          <dt>Inputs</dt>
          <dd>
            {drawable} of {report.fields.length} drawable
          </dd>
        </div>
        <div>
          <dt>Output</dt>
          <dd>
            {report.outputKind
              ? `${report.outputKind}${report.outputIsArray ? ', several' : ''}`
              : 'nothing we can display'}
          </dd>
        </div>
      </dl>

      <ul className={styles.fields}>
        {report.fields.map((field) => (
          <FieldRow key={field.name} field={field} />
        ))}
      </ul>

      {!report.supported && (
        <ul className={styles.reasons}>
          {report.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </article>
  )
}
