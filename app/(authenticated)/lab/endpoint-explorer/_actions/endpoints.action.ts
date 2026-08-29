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

export type AddEndpointResult =
  | { ok: true; endpoint: SavedEndpoint }
  | { ok: false; error: string }

/**
 * Read a pasted FAL model URL and keep the verdict (#523).
 *
 * **Nothing here generates.** It fetches the endpoint's public OpenAPI
 * document -- no key, no queue, no spend -- decides whether we could build
 * controls for it, and stores the report. An unsupported endpoint is saved
 * exactly like a supported one: the list is the record of what has been looked
 * at, and dropping the failures would make the same URL worth pasting twice.
 *
 * Re-adding overwrites, which is how an endpoint is re-checked once the parser
 * has learned something.
 */
export async function addEndpoint(input: string): Promise<AddEndpointResult> {
  const { userId } = await resolveAuth()

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

  const report = parseEndpointSchema(endpointId, doc)
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
      ${userId}, ${endpointId}, ${input.trim()}, ${label},
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

  return { ok: true, endpoint: toSaved(rows[0]) }
}

export async function removeEndpoint(id: string): Promise<void> {
  const { userId } = await resolveAuth()
  await sql`
    delete from fal_endpoints
    where id = ${id} and user_id = ${userId}
  `
}
