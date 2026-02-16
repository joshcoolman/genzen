/**
 * User Images Types
 *
 * Types for the user images feature.
 * Uses Supabase's generated types for database entities.
 */

import { z } from 'zod'
import type { Database } from '@/lib/types/supabase'

/**
 * A user-uploaded image (from database)
 */
export type UserImage = Database['public']['Tables']['user_images']['Row']

/**
 * Data required to create a new user image
 */
export interface CreateUserImageInput {
  title: string
  description?: string | null
  file: File
  file_hash: string
}

/**
 * Data required to update an existing user image
 */
export interface UpdateUserImageInput {
  id: string
  title?: string
  description?: string | null
}

/**
 * Filter options for querying images
 */
export interface UserImageFilters {
  search_term?: string
  limit?: number
  offset?: number
}

// Zod Schemas for validation

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * Schema for creating a new user image
 */
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

/**
 * Schema for updating an existing user image
 */
export const updateUserImageSchema = z.object({
  id: z.string().uuid('Invalid image ID'),

  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must be 200 characters or less')
    .trim()
    .optional(),

  description: z
    .string()
    .max(1000, 'Description must be 1000 characters or less')
    .trim()
    .nullable()
    .optional(),
})

/**
 * Tailwind shade scale (50-950)
 * 11 shades from lightest to darkest
 */
export interface ShadeScale {
  50: string
  100: string
  200: string
  300: string
  400: string
  500: string
  600: string
  700: string
  800: string
  900: string
  950: string
}

/**
 * Color palette v3: 8 hue-diverse colors with shade scales
 */
export interface ColorPalette {
  colors: ShadeScale[]
  metadata: {
    extractionMethod: 'lab-kmeans'
    version: 3
  }
}

/**
 * Type guard to check if palette is v3 format (array of 8 colors)
 */
export function isColorPaletteV3(palette: unknown): palette is ColorPalette {
  if (!palette || typeof palette !== 'object') return false
  const p = palette as Record<string, unknown>
  return (
    'colors' in p &&
    Array.isArray(p.colors) &&
    'metadata' in p &&
    typeof p.metadata === 'object' &&
    p.metadata !== null &&
    'version' in (p.metadata as Record<string, unknown>) &&
    (p.metadata as Record<string, unknown>).version === 3
  )
}
