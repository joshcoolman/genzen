import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  generateImage,
  generatePrompt,
} from "@/features/ai-images/server/generate-image.server";
import { IMAGE_MODELS, DEFAULT_MODEL } from "@/features/ai-images/models";

export const Route = createFileRoute("/dashboard/ai-images")({
  component: AiImagesPage,
});

interface GenerationResult {
  url: string;
  seed: number;
  timings: Record<string, number>;
  elapsed: number;
}

function AiImagesPage() {
  const [prompt, setPrompt] = useState(
    "A golden retriever sitting at a sidewalk cafe table, shot with a 50mm f/1.4 lens, shallow depth of field with creamy bokeh, warm afternoon light casting soft shadows, a cappuccino and croissant on the table, street scene blurred in the background"
  );
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [loading, setLoading] = useState(false);
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await generateImage({
          data: { prompt: prompt.trim(), model },
        });
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate image"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRandomPrompt() {
    if (generatingPrompt) return;

    setGeneratingPrompt(true);
    setError(null);

    try {
      const data = await generatePrompt();
      setPrompt(data.prompt);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate prompt"
      );
    } finally {
      setGeneratingPrompt(false);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">AI Images</h1>

      <div className="bg-card rounded-lg p-6 space-y-4">
        <h2 className="font-medium">Generate Images</h2>

        <div>
          <label
            htmlFor="model-select"
            className="block text-sm font-medium text-muted-foreground mb-1.5"
          >
            Model
          </label>
          <select
            id="model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={loading}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {IMAGE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — {m.description}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="prompt-textarea"
              className="block text-sm font-medium text-muted-foreground"
            >
              Prompt
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRandomPrompt}
              disabled={generatingPrompt || loading}
            >
              {generatingPrompt ? "Generating..." : "Random Prompt"}
            </Button>
          </div>
          <Textarea
            id="prompt-textarea"
            placeholder="Describe the image you want to generate..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            rows={3}
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!prompt.trim() || loading}
        >
          {loading ? "Generating..." : "Generate"}
        </Button>

        {error && (
          <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading && (
          <p className="text-sm text-muted-foreground">
            Generating image, this may take a moment...
          </p>
        )}

        {result && (
          <div className="space-y-3">
            <img
              src={result.url}
              alt={prompt}
              className="rounded-lg max-w-full"
            />
            <p className="text-xs text-muted-foreground">
              Generated in {(result.elapsed / 1000).toFixed(1)}s
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
