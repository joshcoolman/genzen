/**
 * Naming a file that leaves the app carrying part of the library (#480).
 *
 * The reference sheet and the zip are the same gesture -- take these images
 * somewhere else -- so they answer the same question the same way: the group
 * they came from, and how many, because a count is the only thing in the name
 * that says it was not the whole group.
 */

/** `Select One` -> `select-one`. Lowercase, hyphens, nothing the OS reads as
 *  structure -- and never empty, since a group may legitimately be named `...`. */
export function slugName(name: string, fallback: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || fallback
}

/**
 * `select-one-6imgs`, or `<fallback>-6imgs` with no group to name it after.
 *
 * No extension: the callers put their own on, and the zip dialog shows the
 * base in an editable field with `.zip` beside it.
 */
export function countedBaseName(
  groupName: string | null | undefined,
  count: number,
  fallback: string,
): string {
  const base = groupName ? slugName(groupName, fallback) : fallback
  return `${base}-${count}imgs`
}
