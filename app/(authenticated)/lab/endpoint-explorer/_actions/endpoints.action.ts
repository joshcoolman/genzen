'use server'

import {
  endpointIdFromUrl,
  parseEndpointSchema,
  schemaUrlFor,
} from '../parse-schema'
import type { ParsedEndpoint } from '../parse-schema'
import { resolveAuth } from '#/lib/server/auth.server'
import { jsonb, sql } from '#/lib/server/db.server'

/** One saved endpoint, as the page renders it. */
export interface SavedEndpoint {
  id: string
  endpointId: string
  sourceUrl: string
  label: string
  supported: boolean
  report: ParsedEndpoint
  createdAt: string
}

/** A row as the database hands it back. */
interface EndpointRow {
  id: string
  endpoint_id: string
  source_url: string
  label: string
  supported: boolean
  schema: ParsedEndpoint
  created_at: string
}

function toSaved(row: EndpointRow): SavedEndpoint {
  return {
    id: row.id,
    endpointId: row.endpoint_id,
    sourceUrl: row.source_url,
    label: row.label,
    supported: row.supported,
    report: row.schema,
    createdAt: row.created_at,
  }
}

export async function listEndpoints(): Promise<Array<SavedEndpoint>> {
  const { userId } = await resolveAuth()
  const rows = await sql<Array<EndpointRow>>`
    select id, endpoint_id, source_url, label, supported, schema,
           to_json(created_at)#>>'{}' as created_at
    from fal_endpoints
    where user_id = ${userId}
    order by created_at desc
  `
  return rows.map(toSaved)
}

export type CheckEndpointResult =
  | { ok: true; sourceUrl: string; report: ParsedEndpoint }
  | { ok: false; error: string }

/**
 * Read a pasted FAL model URL and report on it (#523).
 *
 * **Nothing here generates, and nothing here is stored.** It fetches the
 * endpoint's public OpenAPI document -- no key, no queue, no spend -- and says
 * whether we could build controls for it. Checking is free and most checks are
 * a glance, so keeping every one of them would turn the page into a wall of
 * reports nobody asked to keep; `saveEndpoint` is the deliberate act.
 */
export async function checkEndpoint(
  input: string,
): Promise<CheckEndpointResult> {
  // Authenticated, though nothing is written: this reaches a third party on the
  // server's behalf, and an unauthenticated caller has no business doing that.
  await resolveAuth()

  const endpointId = endpointIdFromUrl(input)
  if (!endpointId) {
    return {
      ok: false,
      error:
        'Not a FAL model URL. Expected https://fal.ai/models/<id>, or the id on its own.',
    }
  }

  let doc: unknown
  try {
    const res = await fetch(schemaUrlFor(endpointId), {
      // The document changes when FAL ships a model change, which is rare and
      // not on our schedule. Re-adding is the refresh.
      cache: 'no-store',
    })
    if (res.status === 404) {
      return {
        ok: false,
        error: `FAL has no endpoint "${endpointId}". Check the id -- the namespace is not always fal-ai/.`,
      }
    }
    if (!res.ok) {
      return {
        ok: false,
        error: `FAL answered ${res.status} for that endpoint.`,
      }
    }
    doc = await res.json()
  } catch {
    return { ok: false, error: 'Could not reach fal.ai to read the schema.' }
  }

  return {
    ok: true,
    sourceUrl: input.trim(),
    report: parseEndpointSchema(endpointId, doc),
  }
}

/**
 * Keep a checked endpoint.
 *
 * **An unsupported endpoint saves exactly like a supported one.** The rail is
 * the list of endpoints worth coming back to, and "we cannot draw this yet" is
 * a thing worth coming back to -- re-checking it after the parser learns
 * something is most of why the list exists.
 *
 * Re-saving overwrites, so pasting a URL already in the rail is how one is
 * re-checked rather than a way to get two of it.
 */
export async function saveEndpoint(
  sourceUrl: string,
  report: ParsedEndpoint,
): Promise<SavedEndpoint> {
  const { userId } = await resolveAuth()
  const endpointId = report.endpointId
  const label = endpointId.split('/').slice(-2).join('/')

  // `jsonb(...)`, not `JSON.stringify(...)::jsonb`. The driver already
  // serializes a value bound to a json column, so stringifying first stored a
  // jsonb *string* containing JSON, which read back as a string and blew up the
  // report on `report.fields.filter`. That is the helper's whole reason to
  // exist -- see its note in `db.server.ts`.

  const rows = await sql<Array<EndpointRow>>`
    insert into fal_endpoints
      (user_id, endpoint_id, source_url, label, schema, output_kind, supported)
    values (
      ${userId}, ${endpointId}, ${sourceUrl}, ${label},
      ${jsonb(report)}, ${report.outputKind}, ${report.supported}
    )
    on conflict (user_id, endpoint_id) do update set
      source_url = excluded.source_url,
      label = excluded.label,
      schema = excluded.schema,
      output_kind = excluded.output_kind,
      supported = excluded.supported
    returning id, endpoint_id, source_url, label, supported, schema,
              to_json(created_at)#>>'{}' as created_at
  `

  return toSaved(rows[0])
}

export async function removeEndpoint(id: string): Promise<void> {
  const { userId } = await resolveAuth()
  await sql`
    delete from fal_endpoints
    where id = ${id} and user_id = ${userId}
  `
}
