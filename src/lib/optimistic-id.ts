/**
 * Ids for cards that exist on the client before they exist in the database.
 *
 * One prefix for every optimistic path, because the consumers have to
 * *recognise* one: a gallery refresh replaces the whole list, and a card whose
 * request is still in flight has no row to be replaced by. Without a shared
 * shape each path invents its own (`upload-${Date.now()}-...`) and the refresh
 * cannot tell an in-flight card from a stale one.
 *
 * Never sent to the server. A row id is a uuid; this deliberately is not one,
 * so a leak fails loudly rather than querying for something that cannot exist.
 */
const OPTIMISTIC_PREFIX = 'optimistic-'

export function optimisticId(): string {
  return `${OPTIMISTIC_PREFIX}${crypto.randomUUID()}`
}

export function isOptimisticId(id: string): boolean {
  return id.startsWith(OPTIMISTIC_PREFIX)
}
