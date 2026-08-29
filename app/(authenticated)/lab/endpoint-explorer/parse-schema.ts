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
 *
 * **The media hint has two spellings.** `_fal_ui_field: "image"` at the top
 * level, `ui: { field: "image" }` inside a nested schema -- Kling v3's element
 * fields carry only the second. `uiFieldOf` reads both; a reader that knew one
 * classified those by name alone and would miss any media param not ending in
 * `_url`.
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
  /**
   * A set of fields treated as one thing -- Kling v3's `multi_prompt` (a shot
   * list of prompt + duration) and its `elements` (a character as a frontal
   * image, reference angles and a voice). With `multiple`, the group repeats.
   *
   * A sixth kind rather than a special case of `media` or `text`, because it is
   * the one that is not a control at all: it is a small form, and drawing it
   * means a repeater. Reported here so the shape is visible; the control that
   * renders it comes with the rest of them.
   */
  | 'group'

/** What a media slot holds, and what an output is. The three we can display. */
export type MediaKind = 'image' | 'video' | 'audio'

export interface ParsedField {
  name: string
  label: string
  /** Null when the field could not be classified -- `reason` says why. */
  kind: FieldKind | null
  mediaKind?: MediaKind
  /**
   * The field repeats: several files for a `media`, several rows for a `group`.
   * `image_urls` rather than `image_url`; a shot list rather than one shot.
   */
  multiple?: boolean
  /**
   * A `media` slot FAL wants as a `{ url }` object rather than a bare string --
   * cassetteai's `video_url` is a `$ref` to its `Video` schema. Same control,
   * different thing to send, so the difference is recorded rather than lost.
   */
  asObject?: boolean
  /** A `group`'s own fields, parsed exactly as the top-level ones are. */
  fields?: Array<ParsedField>
  /** How many, where the schema caps it. Only meaningful with `multiple`. */
  maxItems?: number
  required: boolean
  description?: string
  /**
   * The schema's declared default. Any JSON, not just a scalar: Seedream's
   * `image_size` defaults to `{ width: 2048, height: 2048 }`.
   */
  defaultValue?: unknown
  /**
   * Cannot be drawn, and does not need to be: optional, with a default the
   * schema states. Omitting it sends that value, so the endpoint is offered
   * anyway -- see `skippable` in the note on `parseEndpointSchema`.
   */
  skipped?: boolean
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

/**
 * The media hint, in either spelling FAL uses.
 *
 * `_fal_ui_field: "image"` at the top level, `ui: { field: "image" }` inside a
 * nested schema. Same fact, two shapes, and Kling v3's element fields carry
 * only the second -- so a reader that knew one spelling classified them by
 * name alone and would have missed any media param not ending in `_url`.
 */
function uiFieldOf(schema: Obj): string | undefined {
  const flat = str(schema._fal_ui_field)
  if (flat) return flat
  return isObj(schema.ui) ? str(schema.ui.field) : undefined
}

/** Is this string field a file the user picks, rather than text they type? */
function looksLikeMedia(name: string, schema: Obj): boolean {
  if (uiFieldOf(schema)) return true
  if (str(schema.format) === 'uri') return true
  return /_url$/.test(name) || /_urls$/.test(name)
}

/** Does this schema describe a file -- a `url` to fetch the thing by? */
function isFileSchema(schema: Obj): boolean {
  return isObj(schema.properties) && 'url' in schema.properties
}

/**
 * Every field of an object schema, in the order FAL publishes.
 *
 * Shared by the top-level input and by a group's members, deliberately: a shot
 * inside `multi_prompt` carries `x-fal-order-properties` exactly as the request
 * does, and a second walk that read it differently would lay the inner form out
 * by accident while the outer one was authored.
 */
function fieldsOf(doc: Obj, schema: Obj, depth = 0): Array<ParsedField> {
  const properties = isObj(schema.properties) ? schema.properties : {}
  const required = new Set(
    (Array.isArray(schema.required) ? schema.required : []).filter(
      (v): v is string => typeof v === 'string',
    ),
  )

  // FAL's authored order where it is published, the document's own key order
  // otherwise -- which is at least stable, and never alphabetical.
  const declaredOrder = (
    Array.isArray(schema['x-fal-order-properties'])
      ? (schema['x-fal-order-properties'] as Array<unknown>)
      : []
  ).filter((v): v is string => typeof v === 'string')

  const names = [
    ...declaredOrder.filter((n) => n in properties),
    ...Object.keys(properties).filter((n) => !declaredOrder.includes(n)),
  ]

  return names.map((name) => {
    const raw = properties[name]
    return parseField(
      doc,
      name,
      isObj(raw) ? raw : {},
      required.has(name),
      depth,
    )
  })
}

/**
 * An object schema read as a set of fields.
 *
 * Returns null rather than a refusal when there is nothing to read, so the
 * caller keeps its own wording for what it was actually looking at -- "a list
 * of values" and "a nested object" are different sentences about the same
 * failure to find fields.
 *
 * **A group is only as supported as its members.** One field inside it we
 * cannot draw means a form with a hole in it, which is the same objection as an
 * unsupported optional at the top level.
 */
function asGroup(
  doc: Obj,
  base: ParsedField,
  target: Obj,
  depth: number,
  multiple: boolean,
): ParsedField | null {
  if (depth >= 1) return { ...base, reason: 'nested too deep to draw' }
  if (!isObj(target.properties)) return null

  const fields = fieldsOf(doc, target, depth + 1)
  if (fields.length === 0) return null

  const broken = fields.find((f) => f.kind === null)
  if (broken) {
    return { ...base, reason: `${broken.name}: ${broken.reason}` }
  }

  return { ...base, kind: 'group', multiple, fields }
}

function parseField(
  doc: Obj,
  name: string,
  raw: Obj,
  required: boolean,
  /** Groups may hold fields; they may not hold groups. One level is what the
   *  real schemas use, and a cap is also the loop guard for a `$ref` that
   *  eventually points back at itself. */
  depth = 0,
): ParsedField {
  const { schema, ambiguous } = unwrapNullable(raw)

  const base: ParsedField = {
    name,
    label: str(schema.title) ?? humanize(name),
    kind: null,
    required,
    description: str(schema.description),
  }

  if ('default' in schema) base.defaultValue = schema.default

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
      const mediaKind = mediaKindFrom(name, uiFieldOf(schema))
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
    const rawItems = isObj(schema.items) ? schema.items : {}
    const itemRef = refOf(rawItems)
    const items = itemRef ? (resolveRef(doc, itemRef) ?? rawItems) : rawItems

    if (str(items.type) === 'string' && looksLikeMedia(name, items)) {
      const mediaKind = mediaKindFrom(name, uiFieldOf(items))
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

    // A list of File objects is still a media slot, not a group.
    if (isFileSchema(items)) {
      const mediaKind = mediaKindFrom(name, uiFieldOf(items))
      if (mediaKind) {
        return {
          ...base,
          kind: 'media',
          mediaKind,
          multiple: true,
          asObject: true,
          maxItems: num(schema.maxItems),
        }
      }
    }

    const group = asGroup(doc, base, items, depth, true)
    if (group) return group
    return { ...base, reason: 'a list of values -- no control for it yet' }
  }

  const selfRef = refOf(raw) ?? refOf(schema)
  if (type === 'object' || selfRef) {
    const target = selfRef ? (resolveRef(doc, selfRef) ?? schema) : schema

    // `{ url, file_name, ... }` is a file, whatever it is called -- cassetteai
    // asks for its video that way rather than as a bare string. Same control as
    // any other media slot; only what gets sent differs.
    if (isFileSchema(target)) {
      const mediaKind = mediaKindFrom(name, uiFieldOf(target))
      if (mediaKind) {
        return { ...base, kind: 'media', mediaKind, asObject: true }
      }
      return { ...base, reason: 'a file input we cannot tell the type of' }
    }

    const group = asGroup(doc, base, target, depth, false)
    if (group) return group
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
 * Is this undrawable field one we can leave out?
 *
 * **Optional, and the schema declares a default.** That default is FAL saying
 * what the model does when the field is absent, so omitting it accepts a stated
 * value rather than silently switching something off.
 *
 * The distinction earns its keep on the shapes that exist. `image_size` is
 * optional and defaults to `landscape_4_3` on FLUX and `{2048, 2048}` on
 * Seedream -- a size nobody was going to type anyway. Kling's `multi_prompt`
 * and `elements`, and Recraft's `image_weights`, declare no default at all:
 * leaving those out is a silent no to the capability that was the reason to
 * pick the model. So the rule blocks exactly the endpoints the strict version
 * was for, and stops blocking the three it should never have caught.
 *
 * A skipped field is still printed, with the default it will get. Hiding it
 * would recreate the silence this is meant to avoid -- the point is that you
 * can always see what the form is not offering you.
 */
function skippable(field: ParsedField): boolean {
  return !field.required && field.defaultValue !== undefined
}

/**
 * The whole verdict for one endpoint.
 *
 * **A field we cannot draw fails the endpoint even when it is optional**,
 * unless `skippable` says otherwise. The blanket-generous rule -- ignore every
 * unsupported optional -- is how a form silently stops offering half of what a
 * model does. The report is meant to say what is missing, so it says it.
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

  const fields = input ? fieldsOf(doc, input) : []

  for (const field of fields) {
    if (field.kind !== null) continue
    if (skippable(field)) {
      field.skipped = true
      continue
    }
    reasons.push(`${field.name}: ${field.reason}`)
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
