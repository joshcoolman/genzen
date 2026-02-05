/**
 * useUserImages Hook
 *
 * React hook for managing user images state and operations.
 * Uses Supabase client directly with RLS for security.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { UserImage, CreateUserImageInput, UserImageFilters } from "../types";

const BUCKET_NAME = "user-images";

interface UseUserImagesState {
  images: UserImage[];
  imageUrls: Record<string, string>;
  isLoading: boolean;
  isCreating: boolean;
  isDeleting: string | null;
  isUpdating: string | null;
  error: string | null;
}

interface UseUserImagesReturn extends UseUserImagesState {
  create: (input: CreateUserImageInput) => Promise<UserImage>;
  update: (
    id: string,
    title: string,
    description: string | null
  ) => Promise<UserImage>;
  deleteImage: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

/**
 * Custom hook for managing user images
 */
export function useUserImages(
  userId: string | undefined,
  filters?: UserImageFilters
): UseUserImagesReturn {
  const [state, setState] = useState<UseUserImagesState>({
    images: [],
    imageUrls: {},
    isLoading: true,
    isCreating: false,
    isDeleting: null,
    isUpdating: null,
    error: null,
  });

  /**
   * Load signed URLs for images
   */
  const loadImageUrls = useCallback(async (images: UserImage[]) => {
    const urls: Record<string, string> = {};

    for (const image of images) {
      try {
        const { data, error } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(image.storage_path, 3600);

        if (!error && data) {
          urls[image.id] = data.signedUrl;
        }
      } catch (err) {
        console.error(`Failed to load URL for image ${image.id}:`, err);
      }
    }

    setState((prev) => ({ ...prev, imageUrls: urls }));
  }, []);

  /**
   * Fetch all images
   */
  const fetchImages = useCallback(async () => {
    if (!userId) {
      setState((prev) => ({ ...prev, isLoading: false, images: [] }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

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

      const { data: images, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      setState((prev) => ({
        ...prev,
        images: images ?? [],
        isLoading: false,
      }));

      // Load URLs in background
      if (images && images.length > 0) {
        loadImageUrls(images);
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Failed to load images",
        isLoading: false,
      }));
    }
  }, [userId, filters, loadImageUrls]);

  // Load images on mount
  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  /**
   * Create a new image
   */
  const create = useCallback(
    async (input: CreateUserImageInput): Promise<UserImage> => {
      if (!userId) throw new Error("User not authenticated");

      try {
        setState((prev) => ({ ...prev, isCreating: true, error: null }));

        // Generate storage path
        const timestamp = Date.now();
        const uuid = crypto.randomUUID();
        const sanitizedFileName = input.file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        const storagePath = `${userId}/${timestamp}_${uuid}_${sanitizedFileName}`;

        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, input.file, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Failed to upload file: ${uploadError.message}`);
        }

        // Create database record
        const { data: newImage, error: insertError } = await supabase
          .from("user_images")
          .insert({
            user_id: userId,
            title: input.title,
            description: input.description ?? null,
            storage_path: storagePath,
            file_name: input.file.name,
            file_size: input.file.size,
            mime_type: input.file.type,
            file_hash: input.file_hash,
          })
          .select()
          .single();

        if (insertError) {
          // Rollback: delete uploaded file
          await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
          throw new Error(`Failed to create image record: ${insertError.message}`);
        }

        // Get signed URL for new image
        const { data: urlData } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(newImage.storage_path, 3600);

        // Update state
        setState((prev) => ({
          ...prev,
          images: [newImage, ...prev.images],
          imageUrls: urlData
            ? { ...prev.imageUrls, [newImage.id]: urlData.signedUrl }
            : prev.imageUrls,
          isCreating: false,
        }));

        return newImage;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to create image",
          isCreating: false,
        }));
        throw err;
      }
    },
    [userId]
  );

  /**
   * Update an existing image
   */
  const update = useCallback(
    async (
      id: string,
      title: string,
      description: string | null
    ): Promise<UserImage> => {
      if (!userId) throw new Error("User not authenticated");

      try {
        setState((prev) => ({ ...prev, isUpdating: id, error: null }));

        // Optimistic update
        setState((prev) => ({
          ...prev,
          images: prev.images.map((img) =>
            img.id === id ? { ...img, title, description } : img
          ),
        }));

        const { data: updatedImage, error } = await supabase
          .from("user_images")
          .update({ title, description })
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

        // Replace with server response
        setState((prev) => ({
          ...prev,
          images: prev.images.map((img) =>
            img.id === updatedImage.id ? updatedImage : img
          ),
          isUpdating: null,
        }));

        return updatedImage;
      } catch (err) {
        // Rollback by refetching
        await fetchImages();
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to update image",
          isUpdating: null,
        }));
        throw err;
      }
    },
    [userId, fetchImages]
  );

  /**
   * Delete an image
   */
  const deleteImageFn = useCallback(
    async (id: string): Promise<void> => {
      if (!userId) throw new Error("User not authenticated");

      try {
        setState((prev) => ({ ...prev, isDeleting: id, error: null }));

        // Get storage path first
        const imageToDelete = state.images.find((img) => img.id === id);
        if (!imageToDelete) {
          throw new Error("Image not found");
        }

        // Optimistic delete
        setState((prev) => ({
          ...prev,
          images: prev.images.filter((img) => img.id !== id),
        }));

        // Delete database record
        const { error: deleteError } = await supabase
          .from("user_images")
          .delete()
          .eq("id", id)
          .eq("user_id", userId);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        // Delete storage file (best effort)
        await supabase.storage
          .from(BUCKET_NAME)
          .remove([imageToDelete.storage_path]);

        setState((prev) => ({ ...prev, isDeleting: null }));
      } catch (err) {
        // Rollback by refetching
        await fetchImages();
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : "Failed to delete image",
          isDeleting: null,
        }));
        throw err;
      }
    },
    [userId, state.images, fetchImages]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    create,
    update,
    deleteImage: deleteImageFn,
    refresh: fetchImages,
    clearError,
  };
}
