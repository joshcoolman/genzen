export function JsonSyntaxHighlight({ json }: { json: string }) {
  let formatted: string
  try {
    formatted = JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    formatted = json
  }

  const highlighted = formatted
    .replace(
      /("(?:\\.|[^"\\])*")\s*:/g,
      '<span class="text-sky-400">$1</span>:',
    )
    .replace(
      /:\s*("(?:\\.|[^"\\])*")/g,
      ': <span class="text-amber-300">$1</span>',
    )
    .replace(
      /:\s*(\d+(?:\.\d+)?)/g,
      ': <span class="text-purple-400">$1</span>',
    )
    .replace(
      /:\s*(true|false|null)/g,
      ': <span class="text-rose-400">$1</span>',
    )

  return (
    <pre
      className="whitespace-pre-wrap break-words rounded-lg border border-border bg-zinc-950 p-4 text-xs font-mono text-zinc-300"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  )
}
