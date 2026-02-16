import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/server/auth.server";
import { ALL_IMAGE_MODELS } from "@/features/ai-images/models";
import crypto from "node:crypto";

interface SaveGeneratedImageInput {
  accessToken: string;
  imageUrl: string;
  prompt: string;
  model: string;
  seed: number;
  timings: Record<string, number>;
  elapsed: number;
}

export const saveGeneratedImage = createServerFn({ method: "POST" })
  .inputValidator((data: SaveGeneratedImageInput) => data)
  .handler(async ({ data }) => {
    const user = await requireAuth(data.accessToken);

    // Fetch image from FAL CDN
    const response = await fetch(data.imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from FAL: ${response.statusText}`);
    }

    const imageBuffer = await response.arrayBuffer();
    const imageBytes = new Uint8Array(imageBuffer);
    const fileSize = imageBytes.length;

    if (fileSize === 0) {
      throw new Error("Downloaded image is empty");
    }

    // Determine mime type from response headers or URL
    const contentType = response.headers.get("content-type") ?? "image/png";
    const mimeType = contentType.split(";")[0].trim();

    // Validate mime type against DB constraint
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    const safeMimeType = allowedTypes.includes(mimeType) ? mimeType : "image/png";

    // Determine file extension
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const ext = extMap[safeMimeType] ?? "png";

    // Compute SHA-256 hash
    const hashBuffer = crypto
      .createHash("sha256")
      .update(imageBytes)
      .digest("hex");

    // Generate storage path and filename
    const timestamp = Date.now();
    const uuid = crypto.randomUUID();
    const fileName = `ai_${timestamp}_${uuid}.${ext}`;
    const storagePath = `${user.id}/${fileName}`;

    // Title = model friendly name, description = prompt
    const modelName =
      ALL_IMAGE_MODELS.find((m) => m.id === data.model)?.name ?? data.model;
    const title = modelName;
    const description =
      data.prompt.length > 997
        ? data.prompt.substring(0, 997) + "..."
        : data.prompt;

    // Create Supabase client authenticated as the user (for RLS)
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        },
      }
    );

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("user-images")
      .upload(storagePath, imageBytes, {
        contentType: safeMimeType,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    // Insert database record
    const { data: savedImage, error: insertError } = await supabase
      .from("user_images")
      .insert({
        user_id: user.id,
        title,
        description,
        storage_path: storagePath,
        file_name: fileName,
        file_size: fileSize,
        mime_type: safeMimeType,
        file_hash: hashBuffer,
        source: "ai_generated",
        generation_metadata: {
          prompt: data.prompt,
          model: data.model,
          seed: data.seed,
          timings: data.timings,
          elapsed: data.elapsed,
        },
      })
      .select()
      .single();

    if (insertError) {
      // Rollback: delete uploaded file
      await supabase.storage.from("user-images").remove([storagePath]);
      throw new Error(`Failed to save image record: ${insertError.message}`);
    }

    return savedImage;
  });
