import { createServerFn } from "@tanstack/react-start";
import { fal } from "@fal-ai/client";

fal.config({ credentials: () => process.env.FAL_KEY ?? "" });

interface GenerateImageInput {
  prompt: string;
  model: string;
}

export const generateImage = createServerFn({ method: "POST" })
  .inputValidator((data: GenerateImageInput) => data)
  .handler(async ({ data }) => {
    const { prompt, model } = data;

    if (!prompt.trim()) {
      throw new Error("Prompt is required");
    }

    if (!process.env.FAL_KEY) {
      throw new Error("FAL_KEY environment variable is not set");
    }

    const start = Date.now();

    const result = await fal.subscribe(model, {
      input: { prompt },
    });

    const elapsed = Date.now() - start;

    const image = result.data?.images?.[0];
    if (!image?.url) {
      throw new Error("No image returned from FAL");
    }

    return {
      url: image.url,
      seed: (result.data?.seed as number) ?? 0,
      timings: (result.data?.timings as Record<string, number>) ?? {},
      elapsed,
    };
  });

export const generatePrompt = createServerFn({ method: "POST" }).handler(
  async () => {
    if (!process.env.FAL_KEY) {
      throw new Error("FAL_KEY environment variable is not set");
    }

    const result = await fal.subscribe("fal-ai/any-llm", {
      input: {
        model: "google/gemini-2.5-flash",
        prompt:
          "Generate a single creative, detailed image generation prompt. Be specific about subject, style, lighting, composition, and mood. Output only the prompt text, nothing else.",
        system_prompt:
          "You are a creative image prompt generator. You produce vivid, detailed prompts for AI image generation. Each prompt should be unique, imaginative, and describe a compelling visual scene. Output only the prompt text with no preamble or explanation.",
      },
    });

    const output = (result.data as { output?: string })?.output ?? "";

    if (!output.trim()) {
      throw new Error("No prompt generated");
    }

    return { prompt: output.trim() };
  }
);
