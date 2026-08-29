import { Check, ExternalLink, X } from 'lucide-react'
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
  if (!field.kind) return '--'

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
  return (
    <li className={cx(styles.field, !field.kind && styles.fieldBad)}>
      <span className={styles.row}>
        <span className={styles.mark} aria-hidden="true">
          {field.kind ? <Check size={14} /> : <X size={14} />}
        </span>
        <code className={styles.fieldName}>{field.name}</code>
        <span className={styles.fieldKind}>
          {describeField(field)}
          {/* Muted, after the description, rather than a mark on the name. A
              red asterisk beside a green tick reads as two verdicts about the
              same field when only one of them is a verdict at all. */}
          {field.required && <span className={styles.req}>required</span>}
        </span>
        {field.reason && (
          <span className={styles.fieldReason}>{field.reason}</span>
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
