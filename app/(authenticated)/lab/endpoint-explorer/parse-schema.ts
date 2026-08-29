/**
 * FAL's published OpenAPI document, read as a form we could draw (#523).
 *
 * Pure and network-free on purpose: the fetch is one line in the action, and
 * everything that can be got wrong is in here where a test can hold it. The
 * only question this file answers is **could we build controls for this
 * endpoint** -- not how they look, and not what they submit.
 *
 * Two things FAL publishes that make this tractable, and that their own form is
 * evidently drawn from:
 *
 *   - `x-fal-order-properties` -- field order, authored rather than alphabetical
 *   - `_fal_ui_field` -- which string is a media picker rather than a text input
 *
 * Neither is guaranteed. `minimax/hailuo-2.3/pro/image-to-video` carries both;
 * `mirelo-ai/sfx-v1.5/video-to-video` carries neither and wraps every optional
 * in `anyOf [T, null]`. So both are treated as hints with a fallback, and the
 * `anyOf` unwrap is the first thing that happens to any property.
 */

/** What kind of control a field would need. Five, and the list is the point:
 *  an endpoint wanting a sixth is one we cannot draw yet, and says so. */
export type FieldKind =
  | 'text'
  | 'textarea'
  | 'enum'
  | 'number'
  | 'boolean'
  | 'media'

/** What a media slot holds, and what an output is. The three we can display. */
export type MediaKind = 'image' | 'video' | 'audio'

export interface ParsedField {
  name: string
  label: string
  /** Null when the field could not be classified -- `reason` says why. */
  kind: FieldKind | null
  mediaKind?: MediaKind
  /** A media field that takes several files -- `image_urls`, not `image_url`. */
  multiple?: boolean
  /** How many, where the schema caps it. Only meaningful with `multiple`. */
  maxItems?: number
  required: boolean
  description?: string
  defaultValue?: string | number | boolean
  enumValues?: Array<string>
  min?: number
  max?: number
  /** `multipleOf`, where the schema states one. */
  step?: number
  maxLength?: number
  /** Set only when `kind` is null. The sentence shown beside the red mark. */
  reason?: string
}

export interface ParsedEndpoint {
  endpointId: string
  /** The schema's own `title`, which is the model's name for itself. */
  title: string
  fields: Array<ParsedField>
  /** Null when the output is something we cannot display. */
  outputKind: MediaKind | null
  /** The property the media comes back on -- `video`, `images`, `audio`. */
  outputField: string | null
  /** The output property is a list, so one run returns several. */
  outputIsArray: boolean
  supported: boolean
  /** Every reason this endpoint is unsupported. Empty when it is supported. */
  reasons: Array<string>
}

/** A JSON object, walked without pretending to know its shape. */
type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/**
 * The endpoint id inside a pasted URL.
 *
 * `https://fal.ai/models/minimax/h3-max/image-to-video?foo=1` is the shape that
 * gets pasted; a bare `minimax/h3-max/image-to-video` is accepted too, because
 * that is what the schema and the code samples show and it is the thing people
 * copy second. Returns null rather than throwing -- a bad paste is a message on
 * the page, not an exception.
 */
export function endpointIdFromUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let path = trimmed
  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL
    try {
      url = new URL(trimmed)
    } catch {
      return null
    }
    if (!/(^|\.)fal\.ai$/i.test(url.hostname)) return null
    // Everything after `/models/`. `/dashboard/...` and the marketing pages
    // have no endpoint in them, so anything else is a miss.
    const match = url.pathname.match(/^\/models\/(.+)$/)
    if (!match) return null
    path = match[1]
  }

  // A trailing `/playground` or `/api` is the tab you were on, not part of the
  // id -- fal.ai/models/<id>/api is a real URL people land on.
  const cleaned = path
    .replace(/[?#].*$/, '')
    .replace(/\/(playground|api|examples|requests|analytics)$/i, '')
    .replace(/^\/+|\/+$/g, '')

  if (!cleaned || !/^[\w.-]+(\/[\w.-]+)+$/.test(cleaned)) return null
  return cleaned
}

/** The URL the OpenAPI document is served from. Public -- no key involved. */
export function schemaUrlFor(endpointId: string): string {
  return `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${encodeURIComponent(endpointId)}`
}

/** `#/components/schemas/Foo` -> the schema it names. */
function resolveRef(doc: Obj, ref: string): Obj | null {
  const name = ref.replace('#/components/schemas/', '')
  const schemas = isObj(doc.components) ? doc.components.schemas : undefined
  if (!isObj(schemas)) return null
  const found = schemas[name]
  return isObj(found) ? found : null
}

function refOf(v: unknown): string | undefined {
  return isObj(v) ? str(v.$ref) : undefined
}

/**
 * The Input schema: the request body of the POST whose path is the endpoint.
 *
 * Found through the path rather than by matching a name ending in `Input`.
 * The titles are inconsistent (`ProImageToVideoHailuo23Input`,
 * `VideoPrecisionUpscaleRequest`) and the document also carries the queue's own
 * schemas, so the only reliable pointer is the one the document itself makes.
 */
function findInputSchema(doc: Obj): Obj | null {
  const paths = isObj(doc.paths) ? doc.paths : {}
  for (const ops of Object.values(paths)) {
    if (!isObj(ops)) continue
    const post = ops.post
    if (!isObj(post) || !isObj(post.requestBody)) continue
    const content = post.requestBody.content
    if (!isObj(content)) continue
    const json = content['application/json']
    if (!isObj(json)) continue
    const ref = refOf(json.schema)
    if (ref) return resolveRef(doc, ref)
    if (isObj(json.schema)) return json.schema
  }
  return null
}

/**
 * The Output schema: the 200 of the GET that fetches a finished request.
 *
 * The POST answers with `QueueStatus` -- the job was accepted, not the media --
 * so reading the POST's response would classify every endpoint in FAL as
 * returning the same thing.
 */
function findOutputSchema(doc: Obj): Obj | null {
  const paths = isObj(doc.paths) ? doc.paths : {}
  for (const [path, ops] of Object.entries(paths)) {
    if (!path.endsWith('/requests/{request_id}')) continue
    if (!isObj(ops) || !isObj(ops.get)) continue
    const ok = isObj(ops.get.responses) ? ops.get.responses['200'] : undefined
    if (!isObj(ok) || !isObj(ok.content)) continue
    const json = ok.content['application/json']
    if (!isObj(json)) continue
    const ref = refOf(json.schema)
    if (ref) return resolveRef(doc, ref)
    if (isObj(json.schema)) return json.schema
  }
  return null
}

/**
 * `anyOf [T, null]` collapsed to `T`.
 *
 * Every optional on some endpoints is written this way, and reading such a
 * property without unwrapping finds no `type` at all -- so it would be reported
 * as unclassifiable and the endpoint would fail for having ordinary optional
 * numbers. Two real branches is a different thing and stays unresolved: a field
 * that is a number *or* a string needs a control that is both.
 */
function unwrapNullable(schema: Obj): { schema: Obj; ambiguous: boolean } {
  const anyOf = schema.anyOf ?? schema.oneOf
  if (!Array.isArray(anyOf)) return { schema, ambiguous: false }

  const real = anyOf.filter((m) => isObj(m) && m.type !== 'null') as Array<Obj>
  if (real.length !== 1) return { schema, ambiguous: true }

  // The wrapper carries `title`, `description` and `default`; the branch
  // carries the type and the range. Both are wanted, and the branch wins where
  // they collide.
  return { schema: { ...schema, ...real[0] }, ambiguous: false }
}

/** `image_url` -> `Image Url`, for a field whose schema gave no title. */
function humanize(name: string): string {
  return name
    .split('_')
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Which of the three media a slot or an output holds.
 *
 * `_fal_ui_field` first where it exists, then the name. The name is a good
 * signal and not a guess: these are `image_url`, `video_url`, `audio_url` --
 * FAL's own naming, consistent across every endpoint read so far.
 */
function mediaKindFrom(name: string, uiField?: string): MediaKind | null {
  const hay = `${uiField ?? ''} ${name}`.toLowerCase()
  if (/video/.test(hay)) return 'video'
  if (/audio|music|speech|sound/.test(hay)) return 'audio'
  if (/image|img|mask|frame|photo/.test(hay)) return 'image'
  return null
}

/** Is this string field a file the user picks, rather than text they type? */
function looksLikeMedia(name: string, schema: Obj): boolean {
  if (str(schema._fal_ui_field)) return true
  if (str(schema.format) === 'uri') return true
  return /_url$/.test(name) || /_urls$/.test(name)
}

function parseField(name: string, raw: Obj, required: boolean): ParsedField {
  const { schema, ambiguous } = unwrapNullable(raw)

  const base: ParsedField = {
    name,
    label: str(schema.title) ?? humanize(name),
    kind: null,
    required,
    description: str(schema.description),
  }

  const rawDefault = schema.default
  if (
    typeof rawDefault === 'string' ||
    typeof rawDefault === 'number' ||
    typeof rawDefault === 'boolean'
  ) {
    base.defaultValue = rawDefault
  }

  if (ambiguous) {
    const branches = (schema.anyOf ?? schema.oneOf) as Array<unknown>
    const types = branches
      .map((m) => (isObj(m) ? (str(m.type) ?? 'ref') : '?'))
      .join(', ')
    return {
      ...base,
      reason: `two possible types (${types}) -- cannot resolve one control`,
    }
  }

  const type = str(schema.type)

  if (Array.isArray(schema.enum)) {
    const values = schema.enum.filter((v): v is string => typeof v === 'string')
    if (values.length !== schema.enum.length) {
      return { ...base, reason: 'enum has non-string values' }
    }
    return { ...base, kind: 'enum', enumValues: values }
  }

  if (type === 'boolean') return { ...base, kind: 'boolean' }

  if (type === 'number' || type === 'integer') {
    return {
      ...base,
      kind: 'number',
      min: num(schema.minimum),
      max: num(schema.maximum),
      step: num(schema.multipleOf) ?? (type === 'integer' ? 1 : undefined),
    }
  }

  if (type === 'string') {
    if (looksLikeMedia(name, schema)) {
      const mediaKind = mediaKindFrom(name, str(schema._fal_ui_field))
      if (!mediaKind) {
        return { ...base, reason: 'a file input we cannot tell the type of' }
      }
      return { ...base, kind: 'media', mediaKind }
    }
    const maxLength = num(schema.maxLength)
    // A prompt is the one field that always wants room. Nothing else here is
    // long by default, so the threshold only has to separate prose from a name.
    const long =
      name === 'prompt' || (maxLength !== undefined && maxLength > 500)
    return { ...base, kind: long ? 'textarea' : 'text', maxLength }
  }

  if (type === 'array') {
    // A list of media URLs is not a new control -- it is the reference strip
    // the app already has. `image_urls` is how every multi-image editor on FAL
    // spells it (Seedream, Nano Banana, Recraft), so refusing arrays outright
    // failed the commonest shape there is.
    const items = isObj(schema.items) ? schema.items : {}
    if (str(items.type) === 'string' && looksLikeMedia(name, items)) {
      const mediaKind = mediaKindFrom(name, str(items._fal_ui_field))
      if (mediaKind) {
        return {
          ...base,
          kind: 'media',
          mediaKind,
          multiple: true,
          maxItems: num(schema.maxItems),
        }
      }
    }
    return { ...base, reason: 'a list of values -- no control for it yet' }
  }
  if (type === 'object' || refOf(raw)) {
    return { ...base, reason: 'a nested object -- no control for it yet' }
  }

  return {
    ...base,
    reason: type ? `unhandled type "${type}"` : 'no type declared',
  }
}

/**
 * The output, classified as one of the three things the app can display.
 *
 * Walks the properties looking for media rather than trusting a fixed key: the
 * shapes seen so far are `{video: File}`, `{images: Image[]}` and
 * `{video: Video-Output[]}`, and the differing ones are the whole reason to
 * look.
 *
 * **The `$ref` has to be resolved, not pattern-matched on its name.** FLUX
 * returns `Image`, mirelo returns `Video-Output`, others return `File` -- the
 * only thing they agree on is that the resolved object has a `url`. Matching
 * the word "File" in the ref classified both of the first two as returning
 * nothing displayable, which is how `flux/dev` came back unsupported.
 */
function parseOutput(
  doc: Obj,
  schema: Obj | null,
): Pick<ParsedEndpoint, 'outputKind' | 'outputField' | 'outputIsArray'> {
  const empty = { outputKind: null, outputField: null, outputIsArray: false }
  if (!schema || !isObj(schema.properties)) return empty

  for (const [name, raw] of Object.entries(schema.properties)) {
    if (!isObj(raw)) continue
    const { schema: prop } = unwrapNullable(raw)
    const isArray = str(prop.type) === 'array'
    const shallow = isArray && isObj(prop.items) ? prop.items : prop
    const ref = refOf(shallow)
    const inner = ref ? (resolveRef(doc, ref) ?? shallow) : shallow
    // A media property is one that resolves to something carrying a `url`.
    const isFile =
      (isObj(inner.properties) && 'url' in inner.properties) ||
      str(inner.format) === 'uri'
    if (!isFile) continue

    const kind = mediaKindFrom(name)
    if (!kind) continue
    return { outputKind: kind, outputField: name, outputIsArray: isArray }
  }

  return empty
}

/**
 * The whole verdict for one endpoint.
 *
 * **A field we cannot draw fails the endpoint even when it is optional.** The
 * softer rule -- ignore unsupported optionals and send their defaults -- reads
 * as generous and is how a form silently stops offering half of what a model
 * does. The report is meant to say what is missing, so it says it.
 */
export function parseEndpointSchema(
  endpointId: string,
  doc: unknown,
): ParsedEndpoint {
  const reasons: Array<string> = []

  if (!isObj(doc)) {
    return {
      endpointId,
      title: endpointId,
      fields: [],
      outputKind: null,
      outputField: null,
      outputIsArray: false,
      supported: false,
      reasons: ['the schema document could not be read'],
    }
  }

  const input = findInputSchema(doc)
  const output = findOutputSchema(doc)

  if (!input) reasons.push('no request schema in the document')

  const properties = input && isObj(input.properties) ? input.properties : {}
  const requiredList =
    input && Array.isArray(input.required) ? input.required : []
  const required = new Set(
    requiredList.filter((v): v is string => typeof v === 'string'),
  )

  // FAL's authored order where it is published, the document's own key order
  // otherwise -- which is at least stable, and never alphabetical.
  const declaredOrder =
    input && Array.isArray(input['x-fal-order-properties'])
      ? (input['x-fal-order-properties'] as Array<unknown>).filter(
          (v): v is string => typeof v === 'string',
        )
      : []
  const names = [
    ...declaredOrder.filter((n) => n in properties),
    ...Object.keys(properties).filter((n) => !declaredOrder.includes(n)),
  ]

  const fields = names.map((name) => {
    const raw = properties[name]
    return parseField(name, isObj(raw) ? raw : {}, required.has(name))
  })

  for (const field of fields) {
    if (field.kind === null) {
      reasons.push(`${field.name}: ${field.reason}`)
    }
  }

  const out = parseOutput(doc, output)
  if (!out.outputKind) {
    reasons.push(
      'the output is not an image, a video or audio -- nothing to display it with',
    )
  }

  return {
    endpointId,
    title: str(input?.title) ?? endpointId,
    fields,
    ...out,
    supported: reasons.length === 0,
    reasons,
  }
}
