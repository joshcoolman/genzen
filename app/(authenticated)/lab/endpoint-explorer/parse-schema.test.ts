import { describe, expect, it } from 'vitest'
import { endpointIdFromUrl, parseEndpointSchema } from './parse-schema'
import type { FieldKind } from './parse-schema'

/**
 * The fixtures are cut from real FAL documents, because the shapes that broke
 * the parser were all real and none of them would have been invented:
 *
 *   - `anyOf [T, null]` on every optional (mirelo). Read without unwrapping,
 *     an ordinary optional number has no `type` and fails the endpoint.
 *   - the output media behind a `$ref` that is *not* called `File` -- `Image`
 *     for FLUX, `Video-Output` for mirelo. Matching the name reported both as
 *     returning nothing displayable.
 *   - `image_urls`, an array of strings, which is how every multi-image editor
 *     on FAL spells its reference slot. Refusing arrays outright failed the
 *     commonest shape there is.
 */

function doc({
  endpoint = 'acme/thing',
  properties,
  required = [],
  order,
  output,
  schemas = {},
}: {
  endpoint?: string
  properties: Record<string, unknown>
  required?: Array<string>
  order?: Array<string>
  output: Record<string, unknown>
  schemas?: Record<string, unknown>
}) {
  return {
    paths: {
      [`/${endpoint}`]: {
        post: {
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/In' },
              },
            },
          },
        },
      },
      [`/${endpoint}/requests/{request_id}`]: {
        get: {
          responses: {
            '200': {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Out' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        In: {
          type: 'object',
          title: 'Thing',
          required,
          ...(order ? { 'x-fal-order-properties': order } : {}),
          properties,
        },
        Out: { type: 'object', properties: output },
        ...schemas,
      },
    },
  }
}

const FILE = { type: 'object', properties: { url: { type: 'string' } } }
const VIDEO_OUT = { video: { $ref: '#/components/schemas/File' } }

function kinds(fields: Array<{ name: string; kind: FieldKind | null }>) {
  return Object.fromEntries(fields.map((f) => [f.name, f.kind]))
}

describe('endpointIdFromUrl', () => {
  it('takes the id out of a model URL', () => {
    expect(
      endpointIdFromUrl('https://fal.ai/models/minimax/h3-max/image-to-video'),
    ).toBe('minimax/h3-max/image-to-video')
  })

  it('drops the tab you were on and any query string', () => {
    expect(
      endpointIdFromUrl(
        'https://fal.ai/models/topaz/upscale/video/precision/api?x=1',
      ),
    ).toBe('topaz/upscale/video/precision')
  })

  it('accepts a bare id, which is what the code samples show', () => {
    expect(endpointIdFromUrl('  fal-ai/flux/dev  ')).toBe('fal-ai/flux/dev')
  })

  it('refuses a URL that is not a fal model page', () => {
    expect(endpointIdFromUrl('https://example.com/models/a/b')).toBeNull()
    expect(endpointIdFromUrl('https://fal.ai/dashboard')).toBeNull()
    expect(endpointIdFromUrl('flux')).toBeNull()
  })
})

describe('parseEndpointSchema', () => {
  it('unwraps anyOf [T, null] rather than failing an ordinary optional', () => {
    const parsed = parseEndpointSchema(
      'acme/thing',
      doc({
        properties: {
          duration: {
            title: 'Duration',
            anyOf: [
              { type: 'number', minimum: 1, maximum: 10 },
              { type: 'null' },
            ],
            default: 10,
          },
        },
        output: VIDEO_OUT,
        schemas: { File: FILE },
      }),
    )

    expect(parsed.supported).toBe(true)
    const [field] = parsed.fields
    expect(field.kind).toBe('number')
    expect(field.min).toBe(1)
    expect(field.max).toBe(10)
    // The wrapper carries the default and the title; the branch carries the
    // range. Both have to survive the merge.
    expect(field.defaultValue).toBe(10)
    expect(field.label).toBe('Duration')
  })

  it('refuses a field with two real branches instead of guessing one', () => {
    const parsed = parseEndpointSchema(
      'acme/thing',
      doc({
        properties: {
          image_size: {
            anyOf: [
              { $ref: '#/components/schemas/ImageSize' },
              { type: 'string', enum: ['square_hd'] },
            ],
          },
        },
        output: VIDEO_OUT,
        schemas: { File: FILE, ImageSize: { type: 'object' } },
      }),
    )

    expect(parsed.supported).toBe(false)
    expect(parsed.fields[0].kind).toBeNull()
    expect(parsed.reasons[0]).toContain('image_size')
  })

  it('reads a media output behind a $ref that is not named File', () => {
    const parsed = parseEndpointSchema(
      'acme/thing',
      doc({
        properties: { prompt: { type: 'string' } },
        required: ['prompt'],
        output: {
          images: {
            type: 'array',
            items: { $ref: '#/components/schemas/Image' },
          },
        },
        schemas: { Image: FILE },
      }),
    )

    expect(parsed.outputKind).toBe('image')
    expect(parsed.outputField).toBe('images')
    expect(parsed.outputIsArray).toBe(true)
    expect(parsed.supported).toBe(true)
  })

  it('treats an array of media URLs as one multi-file slot', () => {
    const parsed = parseEndpointSchema(
      'acme/thing',
      doc({
        properties: {
          image_urls: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 10,
          },
        },
        required: ['image_urls'],
        output: VIDEO_OUT,
        schemas: { File: FILE },
      }),
    )

    const [field] = parsed.fields
    expect(field.kind).toBe('media')
    expect(field.mediaKind).toBe('image')
    expect(field.multiple).toBe(true)
    expect(field.maxItems).toBe(10)
    expect(field.required).toBe(true)
  })

  it('classifies the five control kinds and orders by the published hint', () => {
    const parsed = parseEndpointSchema(
      'acme/thing',
      doc({
        properties: {
          seed: { type: 'integer' },
          prompt: { type: 'string' },
          video_url: { type: 'string', _fal_ui_field: 'video' },
          resolution: { type: 'string', enum: ['480P', '720P'] },
          negative_prompt: { type: 'string' },
          generate_audio: { type: 'boolean' },
        },
        // Deliberately not the key order and not alphabetical -- FAL authors
        // this, and following it is the difference between a form that reads
        // like the model's own and one sorted by accident.
        order: ['prompt', 'video_url', 'resolution', 'generate_audio', 'seed'],
        output: VIDEO_OUT,
        schemas: { File: FILE },
      }),
    )

    expect(parsed.fields.map((f) => f.name)).toEqual([
      'prompt',
      'video_url',
      'resolution',
      'generate_audio',
      'seed',
      // Not in the hint, so it lands after everything that was, rather than
      // being dropped.
      'negative_prompt',
    ])
    expect(kinds(parsed.fields)).toEqual({
      prompt: 'textarea',
      video_url: 'media',
      resolution: 'enum',
      generate_audio: 'boolean',
      seed: 'number',
      negative_prompt: 'text',
    })
    expect(parsed.supported).toBe(true)
  })

  it('refuses an output it could not display', () => {
    const parsed = parseEndpointSchema(
      'recraft/v4/pro/create-style',
      doc({
        properties: { base_style: { type: 'string', enum: ['digital'] } },
        output: { style_id: { type: 'string', format: 'uuid4' } },
      }),
    )

    expect(parsed.supported).toBe(false)
    expect(parsed.outputKind).toBeNull()
    expect(parsed.reasons.join(' ')).toContain('nothing to display it with')
  })

  it('fails an endpoint on an unsupported field even when it is optional', () => {
    const parsed = parseEndpointSchema(
      'acme/thing',
      doc({
        properties: {
          prompt: { type: 'string' },
          weights: { type: 'array', items: { type: 'number' } },
        },
        required: ['prompt'],
        output: VIDEO_OUT,
        schemas: { File: FILE },
      }),
    )

    // Ignoring unsupported optionals reads as generous and is how a form
    // silently stops offering half of what a model does.
    expect(parsed.supported).toBe(false)
    expect(parsed.reasons).toHaveLength(1)
  })
})
