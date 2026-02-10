import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/ai-images")({
  component: AiImagesPage,
});

function AiImagesPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">AI Images</h1>

      <div className="bg-card rounded-lg p-6 space-y-4">
        <h2 className="font-medium">Generate Images</h2>
        <p className="text-sm text-muted-foreground">
          AI image generation coming soon.
        </p>
      </div>
    </div>
  );
}
