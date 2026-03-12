/* eslint-disable @typescript-eslint/no-unnecessary-condition -- defensive checks on external OpenAPI JSON */
/**
 * Fetches and caches FAL video model OpenAPI schemas at runtime.
 * Auto-detects correct parameter names and types per model,
 * eliminating the need for hardcoded per-model if/else branches.
 */

export interface FalVideoSchema {
  /** Parameter name for the start/first frame image */
  imageParam: 'start_image_url' | 'image_url'
  /** Parameter name for the end/last frame image, or null if unsupported */
  endImageParam: 'end_image_url' | null
  /** Whether duration is a number (integer) or string */
  durationIsInteger: boolean
  /** Valid duration values */
  durationValues: Array<string>
  /** Whether cfg_scale is supported */
  supportsCfgScale: boolean
  /** Whether negative_prompt is supported */
  supportsNegativePrompt: boolean
  /** Parameter name for prompt */
  promptParam: string
}

const DEFAULT_SCHEMA: FalVideoSchema = {
  imageParam: 'start_image_url',
  endImageParam: 'end_image_url',
  durationIsInteger: false,
  durationValues: ['5', '10'],
  supportsCfgScale: false,
  supportsNegativePrompt: false,
  promptParam: 'prompt',
}

const schemaCache = new Map<string, FalVideoSchema>()

export async function fetchVideoModelSchema(
  modelId: string,
): Promise<FalVideoSchema> {
  const cached = schemaCache.get(modelId)
  if (cached) return cached

  try {
    const url = `https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${encodeURIComponent(modelId)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const spec = (await res.json()) as OpenAPISpec
    const inputSchema = findInputSchema(spec)
    if (!inputSchema) throw new Error('No input schema found')

    const props = inputSchema.properties ?? {}
    const schema = parseVideoSchemaProperties(props)

    schemaCache.set(modelId, schema)
    return schema
  } catch {
    schemaCache.set(modelId, DEFAULT_SCHEMA)
    return DEFAULT_SCHEMA
  }
}

// -- Schema parsing --

interface SchemaProperty {
  type?: string
  enum?: Array<string | number>
  description?: string
  $ref?: string
}

interface SchemaObject {
  properties?: Record<string, SchemaProperty>
}

interface OpenAPISpec {
  components?: {
    schemas?: Record<string, SchemaObject>
  }
  paths?: Record<
    string,
    Record<
      string,
      {
        requestBody?: {
          content?: Record<string, { schema?: SchemaProperty }>
        }
      }
    >
  >
}

function findInputSchema(spec: OpenAPISpec): SchemaObject | null {
  const paths = spec.paths ?? {}
  for (const methods of Object.values(paths)) {
    const post = methods['post']
    if (!post?.requestBody?.content) continue
    const jsonContent = post.requestBody.content['application/json']
    if (!jsonContent?.schema) continue

    const schemaRef = jsonContent.schema.$ref
    if (schemaRef) {
      return resolveRef(spec, schemaRef)
    }
    return jsonContent.schema as unknown as SchemaObject
  }
  return null
}

function resolveRef(spec: OpenAPISpec, ref: string): SchemaObject | null {
  const parts = ref.replace('#/', '').split('/')
  let obj: unknown = spec as unknown
  for (const p of parts) {
    obj = (obj as Record<string, unknown> | undefined)?.[p]
  }
  return (obj as SchemaObject | null) ?? null
}

function parseVideoSchemaProperties(
  props: Record<string, SchemaProperty>,
): FalVideoSchema {
  // Image input: start_image_url vs image_url
  const imageParam: FalVideoSchema['imageParam'] = props['start_image_url']
    ? 'start_image_url'
    : 'image_url'

  // End image support
  const endImageParam: FalVideoSchema['endImageParam'] = props['end_image_url']
    ? 'end_image_url'
    : null

  // Duration type detection
  const durationProp = props['duration']
  const durationIsInteger = durationProp?.type === 'integer'
  const durationValues = (durationProp?.enum ?? []).map(String)

  // Optional params
  const supportsCfgScale = !!props['cfg_scale']
  const supportsNegativePrompt = !!props['negative_prompt']

  return {
    imageParam,
    endImageParam,
    durationIsInteger,
    durationValues: durationValues.length > 0 ? durationValues : ['5', '10'],
    supportsCfgScale,
    supportsNegativePrompt,
    promptParam: 'prompt',
  }
}
