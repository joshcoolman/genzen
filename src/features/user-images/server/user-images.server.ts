/**
 * User Images Server Functions
 *
 * Server-side functions for managing user images.
 * Uses TanStack Start's createServerFn for type-safe server functions.
 */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/supabase";
import type { UserImageFilters } from "../types";

const BUCKET_NAME = "user-images";

/**
 * Create a server-side Supabase client
 */
function createServerSupabase() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey);
}

interface GetUserImagesInput {
  userId: string;
  filters?: UserImageFilters;
}

/**
 * Get all images for a user
 */
export const getUserImages = createServerFn({ method: "GET" }).handler(
  async (input: GetUserImagesInput) => {
    const { userId, filters } = input;
    const supabase = createServerSupabase();

    let query = supabase
      .from("user_images")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (filters?.search_term) {
      const searchPattern = `%${filters.search_term}%`;
      query = query.or(
        `title.ilike.${searchPattern},description.ilike.${searchPattern}`
      );
    }

    if (filters?.limit !== undefined) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset !== undefined) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit ?? 10) - 1
      );
    }

    const { data: images, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch images: ${error.message}`);
    }

    return images ?? [];
  }
);

interface CreateImageInput {
  userId: string;
  title: string;
  description: string | null;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileHash: string;
}

/**
 * Create a new user image record
 * Note: File upload happens client-side directly to Supabase Storage
 */
export const createUserImage = createServerFn({ method: "POST" }).handler(
  async (input: CreateImageInput) => {
    const supabase = createServerSupabase();

    const { data: image, error } = await supabase
      .from("user_images")
      .insert({
        user_id: input.userId,
        title: input.title,
        description: input.description,
        storage_path: input.storagePath,
        file_name: input.fileName,
        file_size: input.fileSize,
        mime_type: input.mimeType,
        file_hash: input.fileHash,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create image record: ${error.message}`);
    }

    return image;
  }
);

interface UpdateImageInput {
  id: string;
  userId: string;
  title?: string;
  description?: string | null;
}

/**
 * Update an existing user image
 */
export const updateUserImage = createServerFn({ method: "POST" }).handler(
  async (input: UpdateImageInput) => {
    const supabase = createServerSupabase();

    const updateData: Partial<
      Database["public"]["Tables"]["user_images"]["Update"]
    > = {};

    if (input.title !== undefined) {
      updateData.title = input.title;
    }

    if (input.description !== undefined) {
      updateData.description = input.description;
    }

    const { data: image, error } = await supabase
      .from("user_images")
      .update(updateData)
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update image: ${error.message}`);
    }

    return image;
  }
);

interface DeleteImageInput {
  id: string;
  userId: string;
}

/**
 * Delete a user image
 */
export const deleteUserImage = createServerFn({ method: "POST" }).handler(
  async (input: DeleteImageInput) => {
    const supabase = createServerSupabase();

    // First get the image to retrieve storage path
    const { data: image, error: fetchError } = await supabase
      .from("user_images")
      .select("storage_path")
      .eq("id", input.id)
      .eq("user_id", input.userId)
      .single();

    if (fetchError) {
      throw new Error(`Image not found: ${fetchError.message}`);
    }

    // Delete database record first (source of truth)
    const { error: deleteError } = await supabase
      .from("user_images")
      .delete()
      .eq("id", input.id)
      .eq("user_id", input.userId);

    if (deleteError) {
      throw new Error(`Failed to delete image: ${deleteError.message}`);
    }

    // Delete storage file (best effort, don't throw if fails)
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([image.storage_path]);

    if (storageError) {
      console.error(
        `Failed to delete storage file ${image.storage_path}:`,
        storageError
      );
    }

    return { success: true };
  }
);

interface SignedUrlInput {
  storagePath: string;
  expiresIn?: number;
}

/**
 * Get a signed URL for viewing an image
 */
export const getSignedImageUrl = createServerFn({ method: "GET" }).handler(
  async (input: SignedUrlInput) => {
    const supabase = createServerSupabase();

    const expiresIn = input.expiresIn ?? 3600; // Default 1 hour

    const { data: signedUrl, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(input.storagePath, expiresIn);

    if (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }

    return {
      url: signedUrl.signedUrl,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }
);
