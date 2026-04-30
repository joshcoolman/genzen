import { createHash, randomBytes } from 'node:crypto'
import { getSupabaseAdmin } from './supabase-admin.server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const API_KEY_PREFIX = 'gz_live_'
export const API_KEY_DISPLAY_PREFIX_LENGTH = 12

export interface ApiKeyRow {
  id: string
  user_id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface ApiKeyListItem {
  id: string
  name: string
  key_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}

export function generateRawApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`
}

export async function createApiKey({
  userId,
  name,
  client,
}: {
  userId: string
  name: string
  client: SupabaseClient
}): Promise<{ rawKey: string; row: ApiKeyRow }> {
  const rawKey = generateRawApiKey()
  const keyHash = hashApiKey(rawKey)
  const keyPrefix = rawKey.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH)

  const { data, error } = await client
    .from('api_keys')
    .insert({
      user_id: userId,
      name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
    })
    .select(
      'id, user_id, name, key_prefix, created_at, last_used_at, revoked_at',
    )
    .single()

  if (error) throw new Error(`Create API key failed: ${error.message}`)
  return { rawKey, row: data as ApiKeyRow }
}

export async function verifyApiKey({
  rawKey,
  client = getSupabaseAdmin() as unknown as SupabaseClient,
}: {
  rawKey: string
  client?: SupabaseClient
}): Promise<{ userId: string }> {
  if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) {
    throw new Error('Invalid API key')
  }
  const keyHash = hashApiKey(rawKey)

  const { data, error } = await client
    .from('api_keys')
    .select('id, user_id, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (error) throw new Error(`Verify API key failed: ${error.message}`)
  if (!data) throw new Error('Invalid API key')
  if (data.revoked_at) throw new Error('API key revoked')

  await client
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return { userId: data.user_id }
}

export async function revokeApiKey({
  userId,
  id,
  client,
}: {
  userId: string
  id: string
  client: SupabaseClient
}): Promise<void> {
  const { error } = await client
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw new Error(`Revoke API key failed: ${error.message}`)
}

export async function listApiKeys({
  userId,
  client,
}: {
  userId: string
  client: SupabaseClient
}): Promise<Array<ApiKeyListItem>> {
  const { data, error } = await client
    .from('api_keys')
    .select('id, name, key_prefix, created_at, last_used_at, revoked_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`List API keys failed: ${error.message}`)
  return data as Array<ApiKeyListItem>
}
