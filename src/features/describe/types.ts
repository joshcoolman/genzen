import { z } from 'zod'
import type { Database } from '@/lib/types/supabase'

export type UserImage = Database['public']['Tables']['user_images']['Row']

export interface CreateUserImageInput {
  title: string
  description?: string | null
  file: File
  file_hash: string
}

export interface CollectedImage {
  id: string
  title: string
  url: string
  source: string
  addedInSession: boolean
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export const createUserImageSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .trim(),

  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less')
    .trim()
    .nullable()
    .optional(),

  file: z
    .instanceof(File, { message: 'File is required' })
    .refine((file) => file.size > 0, 'File cannot be empty')
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    })
    .refine(
      (file) =>
        ALLOWED_MIME_TYPES.includes(
          file.type as (typeof ALLOWED_MIME_TYPES)[number],
        ),
      {
        message: `File type must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`,
      },
    ),

  file_hash: z
    .string()
    .length(64, 'File hash must be a valid SHA-256 hash (64 hex characters)')
    .regex(/^[a-f0-9]{64}$/, 'File hash must be a valid SHA-256 hash'),
})
