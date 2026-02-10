import { createServerFn } from "@tanstack/react-start";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import { DOCS_DIR } from "./config";
import { parseFileName, sortFileNames } from "./parseFileName";
import { extractHeadings } from "./extractHeadings";
import { slugify, slugToTitle } from "./slugify";
import type { DocFile, DocNavItem, DocNavCategory } from "./types";

// Configure marked with heading IDs
const renderer = new marked.Renderer();
renderer.heading = ({ text, depth }: { text: string; depth: number }) => {
  const id = slugify(text);
  return `<h${depth} id="${id}">${text}</h${depth}>`;
};

marked.use({ renderer, gfm: true });

function scanDocsDirectory(): DocNavItem[] {
  const items: DocNavItem[] = [];

  // Root-level markdown files
  const rootFiles = fs
    .readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"));
  const sortedRoot = sortFileNames(rootFiles);

  for (const fileName of sortedRoot) {
    const parsed = parseFileName(fileName);
    items.push({ slug: parsed.slug, title: slugToTitle(parsed.slug) });
  }

  // Category directories
  const dirs = fs
    .readdirSync(DOCS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();

  for (const dir of dirs) {
    const dirPath = path.join(DOCS_DIR, dir);
    const files = fs
      .readdirSync(dirPath)
      .filter((f) => f.endsWith(".md") && !f.startsWith("_"));
    const sortedFiles = sortFileNames(files);

    for (const fileName of sortedFiles) {
      const parsed = parseFileName(fileName);
      items.push({
        slug: `${dir}/${parsed.slug}`,
        title: slugToTitle(parsed.slug),
        category: slugToTitle(dir),
      });
    }
  }

  return items;
}

function readDocFile(slug: string): DocFile | null {
  // Try root-level first, then category
  const parts = slug.split("/");
  let filePath: string | null = null;
  let category: string | undefined;

  if (parts.length === 1) {
    // Root-level doc - find file matching slug
    const rootFiles = fs
      .readdirSync(DOCS_DIR)
      .filter((f) => f.endsWith(".md") && !f.startsWith("_"));
    const match = rootFiles.find((f) => {
      const parsed = parseFileName(f);
      return parsed.slug === parts[0];
    });
    if (match) {
      filePath = path.join(DOCS_DIR, match);
    }
  } else if (parts.length === 2) {
    // Category doc
    const dirPath = path.join(DOCS_DIR, parts[0]);
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      const files = fs
        .readdirSync(dirPath)
        .filter((f) => f.endsWith(".md") && !f.startsWith("_"));
      const match = files.find((f) => {
        const parsed = parseFileName(f);
        return parsed.slug === parts[1];
      });
      if (match) {
        filePath = path.join(dirPath, match);
        category = slugToTitle(parts[0]);
      }
    }
  }

  if (!filePath || !fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const html = marked(content) as string;

  return {
    slug,
    metadata: {
      title: data.title || slugToTitle(parts[parts.length - 1]),
      description: data.description,
      status: data.status,
      order: data.order,
    },
    content,
    html,
    category,
  };
}

export const getAllDocSlugs = createServerFn({ method: "GET" }).handler(
  async () => {
    return scanDocsDirectory().map((item) => item.slug);
  }
);

export const getDocBySlug = createServerFn({ method: "GET" }).handler(
  // @ts-expect-error -- TanStack Start handler receives ctx with .data at runtime
  async (ctx) => {
    const slug: string = ctx?.data?.slug ?? ctx?.slug ?? "";
    const doc = readDocFile(slug);
    if (!doc) throw new Error(`Doc not found: ${slug}`);

    const headings = extractHeadings(doc.content);
    return { doc, headings };
  }
);

export const getDocNavCategories = createServerFn({ method: "GET" }).handler(
  async () => {
    const items = scanDocsDirectory();
    const categories: DocNavCategory[] = [];
    const uncategorized: DocNavItem[] = [];

    for (const item of items) {
      if (item.category) {
        let cat = categories.find((c) => c.name === item.category);
        if (!cat) {
          cat = { name: item.category!, items: [] };
          categories.push(cat);
        }
        cat.items.push(item);
      } else {
        uncategorized.push(item);
      }
    }

    // Put uncategorized items first as a "General" category
    const result: DocNavCategory[] = [];
    if (uncategorized.length > 0) {
      result.push({ name: "General", items: uncategorized });
    }
    result.push(...categories);

    return result;
  }
);

export const getFirstDocSlug = createServerFn({ method: "GET" }).handler(
  async () => {
    const items = scanDocsDirectory();
    return items.length > 0 ? items[0].slug : null;
  }
);
