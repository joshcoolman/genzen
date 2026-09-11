# Activity context from a URL

## Finding something without a URL

```sh
pnpm context:find --source uploaded
pnpm context:find --day 2026-09-10 --timezone America/New_York
pnpm context:find --query 'car' --source ai_generated --limit 40
pnpm context:inspect '<UUID or contextUrl from the results>'
```

The search returns recent candidates with timestamps, prompts, titles, status,
deletion state and context URLs. It includes uploads, images and clips, across
all origins. It is not restricted to Activity's three-active-day window.
Date bounds are local midnight to the following local midnight in the supplied
IANA timezone, including daylight-saving changes. Without `--day`, results are
the latest records, not restricted to today. `hasMore` reports truncation.

Use the conversation's date/timezone to resolve "yesterday". Titles, descriptions, filenames
and prompts are searchable; an image's visible contents may not be described
in any of them. Inspect likely recent uploads if text search finds nothing.
Search selects `--user <email>` or the sole database user. With multiple
accounts it returns account names and latest-media timestamps first, so the
agent can investigate the plausible accounts separately. `LOCAL_DEV_EMAIL`
is a bootstrap login, not proof of which account is active. Search never
merges multiple accounts. `--origin` selects a URL origin but
does not load credentials; the same environment checks apply as inspection.

For other entities, agents follow the schema and feature instructions with
bounded read-only queries. These commands cover media discovery and inspection,
not every possible app relationship or a provider trace.

## Inspecting an Activity URL

From the repository root:

```sh
pnpm activity:inspect 'http://localhost:3000/activity?entry=<uuid>'
```

`AGENTS.md` tells a fresh Codex session to run this whenever an Activity entry
URL is pasted, then read the report and open the actual images. It does not
depend on earlier chat history. Claude's project instructions point to the
same workflow. Retrieval takes tool calls; this is not a paste-time attachment
hook in the chat application.

The command reads Postgres in a read-only transaction and downloads private
media using the existing workspace credentials. It never calls a generation
provider, polls a pending request, changes a row, or requires the web server.
Only the explicitly named run is retrieved; references are filtered to its
owner. This is a developer CLI with database access, not a public API.

The JSON includes Activity's stored fields, derived model/provider/duration/
cost/error details, the original and sent prompts, unabridged metadata, ordered
references, and absolute media paths. Deleted and missing references stay in
the report. Video last-frame inputs are included separately by role. Pending
and failed runs may have no output; that is reported, not repaired.

Original images and clips are downloaded to a private OS temporary directory
alongside `report.json`. Video output also gets up to ten evenly spaced JPEG
frames using the already-installed `ffmpeg-static`. View the images/frames with
the image tool; a downloaded filename alone is not visual context. Frame
samples cannot establish motion, continuity, or audio. Thumbnails provide a
fallback when originals cannot be downloaded; the report still identifies the
missing original. Temporary downloads can be deleted after the conversation.

## Environment and failures

The command loads `.env.local` relative to the repository; existing process
variables take precedence, matching `pnpm dev`. Local URLs (`localhost`,
`127.0.0.1`, `[::1]`) require a local database. Relative `/activity?entry=...`
links use `APP_URL`, or localhost when it is unset. Extra query parameters and
fragments do not change which entry is selected.

For a deployed link, use the deployment's existing `APP_URL`, `DATABASE_URL`
(public proxy when running from a laptop), and `R2_*` variables. `APP_URL` must
match the link's origin. An isolated environment file can be loaded explicitly:

```sh
node --env-file=/absolute/path/to/deployment.env --experimental-strip-types scripts/inspect-activity.mjs 'https://your-deployment/activity?entry=<uuid>'
```

Never print that file or credentials into a conversation. A remote URL never
falls back to the local database. This machine must have access to the selected
database and bucket; see `docs/deploying.md` for the existing deployment setup.

An unknown entry exits with an error. Missing media produces a report with
warnings so the stored text remains usable. Invalid URLs and ambiguous or
missing entry IDs fail before querying the database. A bare `/activity` link
does not identify a run; ask which entry is intended. Activity's list filters
and pagination are client state and cannot be reconstructed from that URL.

## Fresh-session check

Start a new session in this repository and paste only an Activity entry URL.
The agent should run the command, read its report, view output and references,
and briefly identify what was loaded. Then ask a question about the run. No
mention of the command or screenshot should be necessary in the user prompt.
