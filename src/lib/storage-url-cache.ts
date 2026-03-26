import type { SupabaseClient } from '@supabase/supabase-js'

interface CacheEntry {
  url: string
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

/**
 * Returns a cached signed URL for a storage path, fetching a new one if missing or expired.
 * TTL defaults to 23h — URLs are signed for 24h so this refreshes before expiry.
 */
export async function getCachedSignedUrl(
  supabase: SupabaseClient,
  path: string,
  ttlSeconds = 82800,
): Promise<string | null> {
  const cached = cache.get(path)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url
  }

  const { data } = await supabase.storage
    .from('user-images')
    .createSignedUrl(path, 86400)

  if (!data?.signedUrl) return null

  cache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() + ttlSeconds * 1000,
  })

  return data.signedUrl
}

/** Remove a cached URL entry (call on image delete). */
export function invalidateCachedUrl(path: string): void {
  cache.delete(path)
}
