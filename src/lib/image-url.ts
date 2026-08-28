/**
 * The one place an image URL is constructed (#226).
 *
 * Images are served by the app, not by the bucket. The URL names a
 * `user_images` row, not a storage key, so nothing outside the server ever
 * learns where the object actually lives -- and the route can check who is
 * asking, which a bucket URL cannot.
 *
 * Two surfaces used to rebuild the bucket URL by hand from
 * `VITE_R2_PUBLIC_URL`, so a change to the scheme silently missed them. There
 * is no env var to read here and nothing to inline into the browser: this is a
 * path, and it is stable, which is the point. A presigned URL would expire and
 * defeat the browser cache; `<img src>` stays boring.
 */
/** `end` is a clip's final frame (#512) and 404s when there is not one. */
export type ImageVariant = 'full' | 'thumb' | 'end'

export function imageUrl(imageId: string, variant: ImageVariant = 'full') {
  return variant === 'full' ? `/img/${imageId}` : `/img/${imageId}?v=${variant}`
}
