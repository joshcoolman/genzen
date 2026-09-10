import type { VideoImageInput } from '#/features/video/inputs'

/** Continue changes frame constraints while keeping independently chosen refs. */
export function continueImages<T extends VideoImageInput>(
  images: Array<T>,
  frame: Omit<T, 'role'>,
): Array<T> {
  return [
    { ...frame, role: 'first' } as T,
    ...images.filter(
      (image) => image.role === 'reference' && image.id !== frame.id,
    ),
  ]
}
