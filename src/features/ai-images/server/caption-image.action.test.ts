import { beforeEach, describe, expect, it, vi } from 'vitest'
import { captionImage } from './caption-image.action'
import { sql } from '#/lib/server/db.server'
import { describeImage } from '#/lib/server/describe-image.server'
import { updateImageDescription } from '#/features/user-images/server/images.action'

vi.mock('#/lib/server/auth.server', () => ({
  resolveAuth: vi.fn().mockResolvedValue({ userId: 'owner' }),
}))
vi.mock('#/lib/server/db.server', () => ({
  sql: vi.fn(),
  first: (rows: Array<unknown>) => rows[0],
}))
vi.mock('#/lib/server/describe-image.server', () => ({
  describeImage: vi.fn().mockResolvedValue('The resulting picture'),
}))
vi.mock('#/lib/image-storage', () => ({
  createImageStorage: () => ({
    download: vi.fn().mockResolvedValue(new Blob(['pixels'])),
  }),
}))
vi.mock('#/features/user-images/server/images.action', () => ({
  updateImageDescription: vi.fn(),
}))

const mockSql = sql as unknown as ReturnType<typeof vi.fn>
const imageId = '12345678-1234-1234-1234-123456789012'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('captionImage persistence', () => {
  it('keeps generated descriptions separate from prompts and merges only their metadata key', async () => {
    const metadata = {
      prompt: 'Original prompt',
      sent_prompt: 'Original submitted prompt',
      model: 'model',
      reference_image_ids: ['reference'],
      image_description: 'The resulting picture',
    }
    mockSql.mockResolvedValueOnce([
      { storage_path: 'owner/image', origin: 'images' },
    ])
    mockSql.mockResolvedValueOnce([{ generation_metadata: metadata }])

    const result = await captionImage({
      imageId,
      mode: 'reconstruct',
      persist: true,
    })

    expect(updateImageDescription).not.toHaveBeenCalled()
    const [strings, ...values] = mockSql.mock.calls[1]
    const query = (strings as unknown as Array<string>).join(' ')
    expect(query).toContain('jsonb_set(')
    expect(query).toContain("'{image_description}'")
    expect(query).toContain("coalesce(generation_metadata, '{}'::jsonb)")
    expect(query).not.toMatch(/set\s+description\s*=/)
    expect(query).toContain('and user_id =')
    expect(values).toEqual(['The resulting picture', imageId, 'owner'])
    expect(result.generationMetadata).toEqual(metadata)
  })

  it('preserves upload description storage', async () => {
    mockSql.mockResolvedValueOnce([
      { storage_path: 'owner/image', origin: 'upload' },
    ])
    await captionImage({ imageId, persist: true })
    expect(updateImageDescription).toHaveBeenCalledWith(
      imageId,
      'The resulting picture',
    )
    expect(mockSql).toHaveBeenCalledTimes(1)
  })

  it('does not persist descriptions from the lab by default', async () => {
    await captionImage({ imageBase64: 'pixels' })
    expect(mockSql).not.toHaveBeenCalled()
    expect(updateImageDescription).not.toHaveBeenCalled()
  })

  it('rejects persistence without an image before generating', async () => {
    await expect(
      captionImage({ imageBase64: 'pixels', persist: true }),
    ).rejects.toThrow('persist requires an imageId')
    expect(describeImage).not.toHaveBeenCalled()
  })

  it('does not generate when the owned image cannot be found', async () => {
    mockSql.mockResolvedValueOnce([])
    await expect(captionImage({ imageId, persist: true })).rejects.toThrow(
      'Image not found',
    )
    expect(describeImage).not.toHaveBeenCalled()
  })
})
