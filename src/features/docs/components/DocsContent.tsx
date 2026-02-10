import type { DocFile } from "@/lib/docs/types";

interface DocsContentProps {
  doc: DocFile;
}

export function DocsContent({ doc }: DocsContentProps) {
  return (
    <article className="flex-1 min-w-0 px-8 py-6">
      {doc.category && (
        <p className="text-sm text-muted-foreground mb-1">{doc.category}</p>
      )}
      <h1 className="text-2xl font-bold text-foreground mb-6">
        {doc.metadata.title}
      </h1>
      <div
        className="prose prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: doc.html }}
      />
    </article>
  );
}
