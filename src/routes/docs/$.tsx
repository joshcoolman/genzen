import { createFileRoute } from "@tanstack/react-router";
import { DocsContent } from "@/features/docs/components/DocsContent";
import { TableOfContents } from "@/features/docs/components/TableOfContents";
import { getDocBySlug } from "@/lib/docs/loadDocs.server";

export const Route = createFileRoute("/docs/$")({
  loader: async ({ params }) => {
    const slug = params._splat || "";
    return getDocBySlug({ data: { slug } });
  },
  component: DocPage,
});

function DocPage() {
  const { doc, headings } = Route.useLoaderData();

  return (
    <div className="flex">
      <DocsContent doc={doc} />
      <TableOfContents headings={headings} />
    </div>
  );
}
