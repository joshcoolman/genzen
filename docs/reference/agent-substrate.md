# Agent substrate: designs held for later

Two finished designs, parked until a concrete agent use case pulls on them.
Absorbed from #208 (provenance graph) and #221 (MCP learnings) when the board
was narrowed to a finish state (#222). Nothing here is scheduled; the point is
that neither design has to be re-derived.

## The principle

The primary user of genzen is a human at the app. The likely second user,
someday, is an agent. Design should not foreclose that: keep the generation
path callable without a browser session, keep tool-shaped seams (clear inputs,
clear results, no UI-only state), and treat "could Claude drive this?" as a
lens when shaping features — without building the machine-facing surface
before it's wanted.

---

## Provenance as a queryable graph (from #208)

Not a revival of grouping. #204 removed genealogy as an organizing principle
(parent/child galleries, hidden roots, delete-with-descendants) and that
judgement stands. This is the other thing genealogy was accidentally doing: a
record of **how an image came to exist**, as context for an agent.

### The requirement, stated as the query

> Given one image id, return every image that contributed to it, in order,
> with the role each played and the prompt at each step.

The scenario: upload an image, generate from it, run three variations,
highlight the third and say "this is great, but make something new." An agent
that can walk the chain assembles a request — the upload as character anchor,
one intermediate as style reference, a new prompt carrying intent — instead of
guessing from one image and one sentence.

### The model: edges relational, payload JSONB

Provenance is a graph, so it gets rows:

```sql
create table image_edges (
  child_id  uuid not null references user_images(id) on delete cascade,
  parent_id uuid not null references user_images(id),
  role      text not null,   -- 'source' | 'reference'
  position  int,             -- ordering within a multi-reference generation
  primary key (child_id, parent_id, role)
);
create index on image_edges (parent_id);   -- forward: descendants
create index on image_edges (child_id);    -- backward: ancestry
```

The read is one recursive CTE at arbitrary depth:

```sql
with recursive ancestry as (
  select child_id, parent_id, role, 1 as depth
  from image_edges where child_id = $1
  union all
  select e.child_id, e.parent_id, e.role, a.depth + 1
  from image_edges e join ancestry a on e.child_id = a.parent_id
)
select a.depth, a.role, i.source, i.generation_metadata
from ancestry a join user_images i on i.id = a.parent_id
order by a.depth;
```

The per-hop payload (prompt, model, seed, aspect ratio) stays in
`generation_metadata`. The split is the point: the part with structure becomes
rows, the part without stays a bag.

### Why not JSONB keys

Three failure modes, all demonstrated in this repo:

1. **A JSONB key cannot have a foreign key.** Failed generations are
   hard-deleted, so a text `source_image_id` can dangle today. This is the one
   that matters for the agent case, because of _how_ it fails: a recursive
   walk that hits a dangling id stops early, and a recursion that ends early
   is indistinguishable from one that reached the root. The agent gets a
   three-hop history for a five-hop image with nothing marking it incomplete,
   and anchors on the wrong image, confidently. A history that silently
   truncates is worse than no history — with none, the agent knows it is
   guessing and asks. An FK makes that state unreachable, not merely
   detectable.
2. **Absence is unfalsifiable.** A column with no writer is queryably empty; a
   missing JSONB key is indistinguishable from "legitimately has none"
   (`root_image_id` had readers and zero writers and nothing noticed).
3. **Removing a relationship takes surgery in two places.** #204's migration
   stripped `parent_id` from rows while the write site kept re-adding it. With
   edges, removal is one `delete ... where role = ...`.

### Why not ltree / materialized path / nested sets

**This is a DAG, not a tree** — an image generated from a source plus two
references has three parents. Path-encoding techniques assume a single path to
root and silently fail at the first multi-reference generation. A closure
table is the legitimate alternative (one indexed lookup, no recursion, write
amplification); not needed at this scale.

### Origin is not derivable from provenance

Provenance is what an image descends _from_; origin is which surface it was
_made on_ — a property of the creation event (now the `origin` column, #207).
Walking a canvas generation made from an upload terminates at the upload; its
origin is still canvas. Two images with identical ancestry can have different
origins. They share a principle, not data: first-class facts get columns
written explicitly on every creation path.

### Phases, if built

1. Schema + backfill from existing `source_image_id` (role `source`) and
   `reference_image_ids` (role `reference`, ordered by array position). Rows
   predating the keys are unknowable roots — say so in the migration comment.
2. Write on every creation path, uploads included. Stop writing `parent_id`
   or define what it now means.
3. `getProvenance(imageId)` returning ordered, typed hops with payload — most
   of the deliverable. No UI renders relationships; that would be a separate
   decision.

Open questions held with it: should edges survive hard-deletion of the parent
(cascade is deliberate, but provenance outliving the image may argue for
denormalising a little payload onto the edge); is a materialised root worth it
or is the walk enough (walk first); `position` is per-generation reference
order (confirm nothing else needs it).

---

## MCP surface learnings (from #221)

An MCP surface existed (~1,500 lines: Nitro route, 6 tools, API-key auth,
settings UI) and was deliberately stripped in `2b567fc` — right call, drag on
focus. The code is one `git show 2b567fc^` away; this is the part that was
expensive to learn:

- **Stateless transport.** Streamable HTTP with `sessionIdGenerator:
undefined` and JSON responses — a fresh `McpServer` per request with
  `userId` closed over, closed in a `finally`. No SSE, no session store.
  Cheap because tool registration is pure.
- **Reuse the app's generation path, not a parallel one.** Tools called the
  internal generate/edit functions directly — same rows, same activity log,
  same pricing. An agent surface that forks the pipeline is how invariants
  drift.
- **Auth failures as JSON-RPC envelopes.** 401 as `{jsonrpc, error: {code:
-32001}}` plus `WWW-Authenticate: Bearer`, so MCP clients show an auth
  prompt instead of a generic transport error.
- **Key design.** `gz_live_` + 32 random bytes base64url; stored as bare
  SHA-256 hex — defensible _only_ because the key is 256 bits of entropy, not
  a password — unique index for O(1) lookup, 12-char plaintext prefix for
  display, `last_used_at` bumped on verify.
- **Explicit user_id on every read and write** from any credential that
  bypasses row policy. A machine-facing surface doubles the exposure of the
  #219 invariant.
- **Install UX.** The key-reveal dialog emitted a ready-to-paste
  `claude mcp add ...` command with the key embedded, URL taken from
  `window.location.origin` so dev/prod self-corrected.
- **Blocking generation over request/response.** Poll every 1.5s, cap at 90s;
  on timeout fail with the recordId and a "check Activity" pointer — degrade
  to a reference, never lose the work.
- **Tool schemas as model instructions.** Every Zod field carried a
  `.describe()` written to the calling model ("Model id from
  list_image_models (e.g. fal-ai/flux/schnell)").
