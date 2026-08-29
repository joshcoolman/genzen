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

  it('reads an array of objects as one repeating group', () => {
    const parsed = parseEndpointSchema(
      'fal-ai/kling-video/v3/pro/image-to-video',
      doc({
        properties: {
          multi_prompt: {
            anyOf: [
              {
                type: 'array',
                items: { $ref: '#/components/schemas/Shot' },
              },
              { type: 'null' },
            ],
          },
        },
        output: VIDEO_OUT,
        schemas: {
          File: FILE,
          Shot: {
            type: 'object',
            required: ['prompt'],
            'x-fal-order-properties': ['prompt', 'duration'],
            properties: {
              duration: { type: 'string', enum: ['5', '10'] },
              prompt: { type: 'string' },
            },
          },
        },
      }),
    )

    expect(parsed.supported).toBe(true)
    const [field] = parsed.fields
    expect(field.kind).toBe('group')
    expect(field.multiple).toBe(true)
    // The group's own `x-fal-order-properties` is honoured, not just the
    // request's -- a shot is authored the same way the request is.
    expect(field.fields?.map((f) => f.name)).toEqual(['prompt', 'duration'])
    expect(field.fields?.map((f) => f.kind)).toEqual(['textarea', 'enum'])
    expect(field.fields?.[0].required).toBe(true)
  })

  it('fails a group whose own member cannot be drawn', () => {
    const parsed = parseEndpointSchema(
      'acme/thing',
      doc({
        properties: {
          rows: {
            type: 'array',
            items: { $ref: '#/components/schemas/Row' },
          },
        },
        output: VIDEO_OUT,
        schemas: {
          File: FILE,
          Row: {
            type: 'object',
            properties: {
              weights: { type: 'array', items: { type: 'number' } },
            },
          },
        },
      }),
    )

    // A form with a hole in it is the same objection as an unsupported
    // optional at the top level.
    expect(parsed.supported).toBe(false)
    expect(parsed.fields[0].kind).toBeNull()
    expect(parsed.fields[0].reason).toContain('weights')
  })

  it('reads a $ref to a File object as a media slot, not a nested object', () => {
    const parsed = parseEndpointSchema(
      'cassetteai/video-sound-effects-generator',
      doc({
        properties: { video_url: { $ref: '#/components/schemas/Video' } },
        required: ['video_url'],
        output: VIDEO_OUT,
        schemas: { File: FILE, Video: FILE },
      }),
    )

    const [field] = parsed.fields
    expect(field.kind).toBe('media')
    expect(field.mediaKind).toBe('video')
    // Same control, different thing to send: FAL wants `{ url }` here rather
    // than a bare string.
    expect(field.asObject).toBe(true)
    expect(parsed.supported).toBe(true)
  })

  it('reads the media hint in either spelling FAL uses', () => {
    const parsed = parseEndpointSchema(
      'acme/thing',
      doc({
        properties: {
          // Nested schemas carry `ui: { field }`; top-level ones carry
          // `_fal_ui_field`. A reader that knew one spelling classified Kling's
          // element fields by name alone.
          poster: { type: 'string', ui: { field: 'image' } },
          clip: { type: 'string', _fal_ui_field: 'video' },
        },
        output: VIDEO_OUT,
        schemas: { File: FILE },
      }),
    )

    expect(parsed.fields.map((f) => [f.kind, f.mediaKind])).toEqual([
      ['media', 'image'],
      ['media', 'video'],
    ])
  })

  it('skips an undrawable optional that declares a default', () => {
    const parsed = parseEndpointSchema(
      'fal-ai/bytedance/seedream/v4.5/edit',
      doc({
        properties: {
          prompt: { type: 'string' },
          image_size: {
            anyOf: [
              { $ref: '#/components/schemas/ImageSize' },
              { type: 'string', enum: ['square_hd', 'landscape_4_3'] },
            ],
            default: { width: 2048, height: 2048 },
          },
        },
        required: ['prompt'],
        output: {
          images: {
            type: 'array',
            items: { $ref: '#/components/schemas/Image' },
          },
        },
        schemas: { Image: FILE, ImageSize: { type: 'object' } },
      }),
    )

    // Omitting it sends the value FAL states, so the endpoint is offered.
    expect(parsed.supported).toBe(true)
    expect(parsed.reasons).toHaveLength(0)

    const size = parsed.fields[1]
    expect(size.kind).toBeNull()
    expect(size.skipped).toBe(true)
    // Still carries its default, because the report prints what you are stuck
    // with rather than hiding the field.
    expect(size.defaultValue).toEqual({ width: 2048, height: 2048 })
  })

  it('does not skip an undrawable optional with no default', () => {
    const parsed = parseEndpointSchema(
      'acme/thing',
      doc({
        properties: {
          // Kling's `multi_prompt` and `elements` are exactly this shape:
          // optional, no default. Leaving one out is a silent no to the
          // capability that was the reason to pick the model.
          elements: { type: 'array', items: { type: 'number' } },
        },
        output: VIDEO_OUT,
        schemas: { File: FILE },
      }),
    )

    expect(parsed.supported).toBe(false)
    expect(parsed.fields[0].skipped).toBeUndefined()
    expect(parsed.reasons[0]).toContain('elements')
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
