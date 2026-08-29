import { Check, ExternalLink, X } from 'lucide-react'
import styles from './endpoint-report.module.css'
import type { ParsedField } from '../../parse-schema'
import type { SavedEndpoint } from '../../_actions/endpoints.action'
import { Badge, IconButton } from '#/components'
import { cx } from '#/lib/utils'

/**
 * What a field's control would be, in one line.
 *
 * The ranges and enum sizes are the point, not decoration -- "enum" says a
 * dropdown exists, "enum(21)" says Topaz offers twenty-one upscaling models and
 * a row of pills is the wrong shape for it. Reading that off the report is how
 * the real controls get designed without guessing.
 */
function describeField(field: ParsedField): string {
  if (!field.kind) return '--'

  switch (field.kind) {
    case 'media':
      return `${field.mediaKind}${field.multiple ? `s${field.maxItems ? ` (up to ${field.maxItems})` : ''}` : ''}`
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

export function EndpointReport({
  endpoint,
  onRemove,
}: {
  endpoint: SavedEndpoint
  onRemove: () => void
}) {
  const { report } = endpoint
  const drawable = report.fields.filter((f) => f.kind).length

  return (
    <article
      className={cx(styles.card, !endpoint.supported && styles.cardUnsupported)}
    >
      <header className={styles.head}>
        <div className={styles.identity}>
          <code className={styles.endpointId}>{report.endpointId}</code>
          <p className={styles.title}>{report.title}</p>
        </div>
        <div className={styles.actions}>
          <Badge
            className={endpoint.supported ? styles.badgeOk : styles.badgeBad}
          >
            {endpoint.supported ? 'Supported' : 'Not supported'}
          </Badge>
          {/* An anchor, not a button that calls `window.open`: the way back to
              the model page is a link, and a link is middle-clickable. */}
          <a
            className={styles.external}
            href={endpoint.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open on fal.ai"
            title="Open on fal.ai"
          >
            <ExternalLink size={15} />
          </a>
          <IconButton aria-label="Remove endpoint" onClick={onRemove}>
            <X size={15} />
          </IconButton>
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
          <li
            key={field.name}
            className={cx(styles.field, !field.kind && styles.fieldBad)}
          >
            <span className={styles.mark} aria-hidden="true">
              {field.kind ? <Check size={14} /> : <X size={14} />}
            </span>
            <code className={styles.fieldName}>
              {field.name}
              {/* Required is on the name because that is the thing you have to
                  supply -- an unsupported optional is a smaller problem than an
                  unsupported required one, and the report should let you see
                  which you are looking at. */}
              {field.required && <span className={styles.req}>*</span>}
            </code>
            <span className={styles.fieldKind}>{describeField(field)}</span>
            {field.reason && (
              <span className={styles.fieldReason}>{field.reason}</span>
            )}
          </li>
        ))}
      </ul>

      {!endpoint.supported && (
        <ul className={styles.reasons}>
          {report.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </article>
  )
}
