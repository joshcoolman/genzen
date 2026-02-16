/**
 * Generate Palette Edge Function
 *
 * Extracts 8 hue-diverse colors from uploaded images using
 * LAB color space K-means clustering for perceptual accuracy.
 * Each color has full Tailwind shade scales (50-950).
 *
 * Triggered via HTTP call after image upload.
 * Updated: 2026-02-06
 */

import {
  ImageMagick,
  initializeImageMagick,
} from 'npm:@imagemagick/magick-wasm@0.0.30'
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  samplePixels,
  extractColors,
  extractColorsRandom,
  extractColorsQuadrant,
} from './quantize.ts'
import { buildPalette, type PaletteExport } from './palette.ts'

// Initialize ImageMagick WASM
const wasmBytes = await Deno.readFile(
  new URL(
    'magick.wasm',
    import.meta.resolve('npm:@imagemagick/magick-wasm@0.0.30'),
  ),
)
await initializeImageMagick(wasmBytes)

// CORS headers for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface PaletteRequest {
  image_id: string
  storage_path: string
  user_id: string
  mode?: 'quadrant' | 'smart' | 'random' // quadrant = simple sampling, smart = hue-diverse k-means, random = scattershot
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const {
      image_id,
      storage_path,
      user_id,
      mode = 'quadrant',
    }: PaletteRequest = await req.json()

    if (!image_id || !storage_path || !user_id) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: image_id, storage_path, user_id',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Download image from storage
    const { data: imageData, error: downloadError } = await supabase.storage
      .from('user-images')
      .download(storage_path)

    if (downloadError) {
      throw new Error(`Failed to download image: ${downloadError.message}`)
    }

    // Convert blob to array buffer
    const arrayBuffer = await imageData.arrayBuffer()
    const imageBytes = new Uint8Array(arrayBuffer)

    // Process image with ImageMagick to get pixel data
    let palette: PaletteExport

    ImageMagick.read(imageBytes, (img) => {
      // Resize for performance (max 200x200)
      const maxDim = 200
      if (img.width > maxDim || img.height > maxDim) {
        const ratio = Math.min(maxDim / img.width, maxDim / img.height)
        const newWidth = Math.round(img.width * ratio)
        const newHeight = Math.round(img.height * ratio)
        img.resize(newWidth, newHeight)
      }

      // Gaussian blur to smooth out noise and outliers
      // Each sampled pixel becomes representative of its region
      img.blur(0, 8)

      // Get pixel data as RGBA
      const imageWidth = img.width
      const pixels = img.getPixels((pixelCollection) => {
        const width = img.width
        const height = img.height
        const rgbaData = new Uint8ClampedArray(width * height * 4)

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const pixel = pixelCollection.getPixel(x, y)
            const idx = (y * width + x) * 4
            rgbaData[idx] = pixel[0] // R
            rgbaData[idx + 1] = pixel[1] // G
            rgbaData[idx + 2] = pixel[2] // B
            rgbaData[idx + 3] = pixel[3] ?? 255 // A
          }
        }

        return rgbaData
      })

      // Sample pixels for extraction (not needed for quadrant mode)
      const sampledPixels = samplePixels(pixels, 5)

      // Extract colors based on mode
      let extractedColors
      if (mode === 'quadrant') {
        // Simple quadrant sampling - uses raw pixel array directly
        const allPixels: [number, number, number][] = []
        for (let i = 0; i < pixels.length; i += 4) {
          allPixels.push([pixels[i], pixels[i + 1], pixels[i + 2]])
        }
        extractedColors = extractColorsQuadrant(allPixels, imageWidth, 8)
      } else if (mode === 'random') {
        extractedColors = extractColorsRandom(sampledPixels, imageWidth, 8)
      } else {
        extractedColors = extractColors(sampledPixels, 8)
      }

      // Build the palette with shade scales
      palette = buildPalette(extractedColors)
    })

    // Update the database with the palette
    const { error: updateError } = await supabase
      .from('user_images')
      .update({ color_palette: palette! })
      .eq('id', image_id)
      .eq('user_id', user_id)

    if (updateError) {
      throw new Error(`Failed to update palette: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        image_id,
        palette: palette!,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Palette generation error:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
