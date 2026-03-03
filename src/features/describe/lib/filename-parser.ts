export function parseFilenameToTitle(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '')
  const withSpaces = withoutExtension.replace(/[_-]+/g, ' ')
  const titleCased = withSpaces
    .split(' ')
    .map((word) => {
      if (word.length === 0) return ''
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
  return titleCased.trim()
}
