// Markdown files are loaded as raw text (see `turbopack.rules` in next.config.ts).
declare module '*.md' {
  const content: string
  export default content
}
