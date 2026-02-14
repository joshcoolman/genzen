import { createServerFn } from "@tanstack/react-start";
import { fal } from "@fal-ai/client";
import { requireAuth } from "@/lib/server/auth.server";

fal.config({ credentials: () => process.env.FAL_KEY ?? "" });

interface GenerateImageInput {
  prompt: string;
  model: string;
  accessToken: string;
}

export const generateImage = createServerFn({ method: "POST" })
  .inputValidator((data: GenerateImageInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken);

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

interface GeneratePromptInput {
  accessToken: string;
}

// Prompt variety pools - picked randomly to seed each generation
const SCENES = [
  "a quiet cafe scene", "a busy street corner in Tokyo", "a dog waiting by a door",
  "a mechanic under a car hood", "someone reading on a park bench", "a barber at work",
  "a fisherman at dawn", "a chef plating a dish", "a couple arguing in a diner",
  "a child discovering snow for the first time", "a boxer between rounds",
  "an executive nervous before a board meeting", "a street musician playing saxophone",
  "a woman at a laundromat at night", "a cyberpunk bar scene", "an old bookshop interior",
  "a surfer watching the ocean", "a farmer's market in morning light", "a taxi driver at 3am",
  "an astronaut looking at Earth", "a rainy window reflection", "a cat in a sunbeam",
  "a construction worker on a high beam", "a dancer mid-leap", "a lighthouse in a storm",
  "someone cooking in a tiny apartment", "a vintage gas station at dusk",
  "a crowded subway car", "a scientist in a lab", "a grandmother's kitchen",
];

const FILM_STOCKS = [
  "Kodak Portra 400", "Kodak Portra 800", "Kodak Ektar 100", "Kodak Tri-X 400",
  "Kodachrome 64", "Fujifilm Pro 400H", "Fujifilm Velvia 50", "CineStill 800T",
  "CineStill 50D", "Ilford HP5 Plus 400", "Ilford Delta 3200", "Kodak Gold 200",
  "Fujifilm Superia 400", "Agfa Vista 200",
];

const LENSES = [
  "24mm wide angle", "35mm f/1.4", "50mm f/1.4", "50mm Carl Zeiss Planar",
  "85mm f/1.2", "105mm f/2.8 macro", "135mm f/2", "Helios 44-2 58mm",
  "anamorphic lens", "tilt-shift lens",
];

const LIGHTING = [
  "golden hour", "blue hour", "available light", "diffused window light",
  "Rembrandt lighting", "neon lighting", "backlit", "overcast",
  "hard flash", "candlelight", "volumetric lighting", "dappled light",
  "low key lighting", "split lighting", "rim lighting",
];

const SHOT_TYPES = [
  "close-up", "extreme close-up", "medium shot", "wide shot",
  "low angle", "bird's eye view", "three-quarter view",
  "over-the-shoulder", "full body shot", "Dutch angle",
];

const PHOTOGRAPHERS = [
  "William Eggleston", "Saul Leiter", "Fan Ho", "Gregory Crewdson",
  "Henri Cartier-Bresson", "Vivian Maier", "Steve McCurry", "Daido Moriyama",
  "Joel Meyerowitz", "Martin Parr", "Annie Leibovitz", "Helmut Newton",
  "Sebastião Salgado", "Alex Webb", "Peter Lindbergh",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const generatePrompt = createServerFn({ method: "POST" })
  .inputValidator((data: GeneratePromptInput) => data)
  .handler(async ({ data }) => {
    await requireAuth(data.accessToken);

    if (!process.env.FAL_KEY) {
      throw new Error("FAL_KEY environment variable is not set");
    }

    // Seed the LLM with random technical direction
    const scene = pick(SCENES);
    const film = pick(FILM_STOCKS);
    const lens = pick(LENSES);
    const light = pick(LIGHTING);
    const shot = pick(SHOT_TYPES);
    // 30% chance to include a photographer reference
    const photographerRef = Math.random() < 0.3
      ? `, in the style of ${pick(PHOTOGRAPHERS)}`
      : "";

    const result = await fal.subscribe("fal-ai/any-llm", {
      input: {
        model: "google/gemini-2.5-flash",
        prompt: `Write a short image prompt (1-2 sentences max) based on this seed. Keep the scene description simple and human. Add the technical photography details naturally at the end.

Scene: ${scene}
Technical: ${shot}, ${lens}, ${film}, ${light}${photographerRef}

Output only the prompt, nothing else.`,
        system_prompt:
          "You write concise image generation prompts. Simple everyday or cinematic scenes with expert-level photography direction. Never flowery or verbose. Think photographer's shot notes, not fantasy novel. 1-2 sentences. Mix the mundane with the technical.",
      },
    });

    const output = (result.data as { output?: string })?.output ?? "";

    if (!output.trim()) {
      throw new Error("No prompt generated");
    }

    return { prompt: output.trim() };
  });
