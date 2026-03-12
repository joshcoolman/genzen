/* eslint-disable @typescript-eslint/no-unnecessary-condition -- defensive checks on external OpenAPI JSON */
/**
 * Fetches and caches FAL model OpenAPI schemas at runtime.
 * Used by buildFalInput() to auto-detect correct params per model.
 */

export interface FalModelSchema {
  sizeParam: 'image_size' | 'aspect_ratio' | null
  imageSizeAcceptsObject: boolean
  imageSizeEnumValues?: Array<string>
  aspectRatioEnumValues?: Array<string>
  safetyParam: 'safety_tolerance' | 'enable_safety_checker' | null
  safetyToleranceMax: string | null
  imageInputParam: 'image_url' | 'image_urls' | null
}

const DEFAULT_SCHEMA: FalModelSchema = {
  sizeParam: 'image_size',
  imageSizeAcceptsObject: true,
  imageSizeEnumValues: undefined,
  aspectRatioEnumValues: undefined,
  safetyParam: 'enable_safety_checker',
  safetyToleranceMax: null,
  imageInputParam: null,
}

const schemaCache = new Map<string, FalModelSchema>()

export async function fetchModelSchema(
  modelId: string,
): Promise<FalModelSchema> {
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
    const schema = parseSchemaProperties(props, spec)

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
  enum?: Array<string>
  anyOf?: Array<{ $ref?: string; type?: string; enum?: Array<string> }>
  $ref?: string
}

interface SchemaObject {
  properties?: Record<string, SchemaProperty>
  required?: Array<string>
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
  // The POST endpoint's requestBody schema contains the input properties
  const paths = spec.paths ?? {}
  for (const methods of Object.values(paths)) {
    const post = methods['post']
    if (!post?.requestBody?.content) continue
    const jsonContent = post.requestBody.content['application/json']
    if (!jsonContent?.schema) continue

    // Resolve $ref if needed
    const schemaRef = jsonContent.schema.$ref
    if (schemaRef) {
      return resolveRef(spec, schemaRef)
    }
    return jsonContent.schema as unknown as SchemaObject
  }
  return null
}

function resolveRef(spec: OpenAPISpec, ref: string): SchemaObject | null {
  // refs look like "#/components/schemas/SomeName"
  const parts = ref.replace('#/', '').split('/')
  let obj: unknown = spec as unknown
  for (const p of parts) {
    obj = (obj as Record<string, unknown> | undefined)?.[p]
  }
  return (obj as SchemaObject | null) ?? null
}

function parseSchemaProperties(
  props: Record<string, SchemaProperty>,
  spec: OpenAPISpec,
): FalModelSchema {
  // Size param detection
  let sizeParam: FalModelSchema['sizeParam'] = null
  let imageSizeAcceptsObject = false
  let imageSizeEnumValues: Array<string> | undefined

  let aspectRatioEnumValues: Array<string> | undefined

  if (props['aspect_ratio']) {
    sizeParam = 'aspect_ratio'
    const ratioProp = props['aspect_ratio']
    if (ratioProp.enum) {
      aspectRatioEnumValues = ratioProp.enum
    } else if (ratioProp.anyOf) {
      for (const variant of ratioProp.anyOf) {
        if (variant.enum) {
          aspectRatioEnumValues = variant.enum
        }
      }
    }
  } else if (props['image_size']) {
    sizeParam = 'image_size'
    const sizeProp = props['image_size']

    if (sizeProp.anyOf) {
      for (const variant of sizeProp.anyOf) {
        if (variant.$ref) {
          // Check if ref resolves to an object with width/height (ImageSize)
          const resolved = resolveRef(spec, variant.$ref)
          if (
            resolved?.properties?.['width'] &&
            resolved?.properties?.['height']
          ) {
            imageSizeAcceptsObject = true
          }
        }
        if (variant.enum) {
          imageSizeEnumValues = variant.enum
        }
      }
    } else if (sizeProp.enum) {
      imageSizeEnumValues = sizeProp.enum
    }
  }

  // Safety param detection — prefer safety_tolerance over enable_safety_checker
  let safetyParam: FalModelSchema['safetyParam'] = null
  let safetyToleranceMax: string | null = null

  if (props['safety_tolerance']) {
    safetyParam = 'safety_tolerance'
    const toleranceProp = props['safety_tolerance']
    const enumVals = toleranceProp.enum
    if (enumVals?.length) {
      // Get highest numeric value from enum (they come as strings like "1"-"6")
      safetyToleranceMax = enumVals.reduce((max, val) =>
        Number(val) > Number(max) ? val : max,
      )
    }
  } else if (props['enable_safety_checker']) {
    safetyParam = 'enable_safety_checker'
  }

  // Image input param detection
  let imageInputParam: FalModelSchema['imageInputParam'] = null
  if (props['image_urls']) {
    imageInputParam = 'image_urls'
  } else if (props['image_url']) {
    imageInputParam = 'image_url'
  }

  return {
    sizeParam,
    imageSizeAcceptsObject,
    imageSizeEnumValues,
    aspectRatioEnumValues,
    safetyParam,
    safetyToleranceMax,
    imageInputParam,
  }
}
