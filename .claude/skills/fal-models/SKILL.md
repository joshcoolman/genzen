---
name: fal-models
description: Search FAL model API and cross-reference against local models.ts registry. Use when adding, verifying, or referencing FAL model IDs to prevent typos and ensure correct endpoint_id values.
user_invocable: true
invocation_hint: fal models search verify
---

# FAL Models Skill

Search FAL's model discovery API and cross-reference results against the local model registry in `src/features/ai-images/models.ts`.

## Step 1: Parse the query

- If the argument is `verify` or `audit` -> **audit mode** (check all local models against FAL API)
- Otherwise -> **search mode** (use the argument as a search query)

## Step 2: Read local registry

Read `src/features/ai-images/models.ts` and extract:

- All model IDs from the `ALL_IMAGE_MODELS` array
- All model IDs from the `EDIT_MODELS` array
- Feature-specific constants: `STORYBOARD_FRAME_MODEL`, `CHARACTER_REF_MODEL`, `DEFAULT_MODEL`, `DEFAULT_EDIT_MODEL`

Build a set of all known local model IDs for cross-referencing.

## Step 3: Query FAL API

### Search mode

Fetch results from FAL's model discovery API:

```
WebFetch https://fal.ai/api/models?q={query}&limit=10&category=text-to-image
```

Extract `endpoint_id`, `display_name`, `category`, and `status` for each result.

If no results for `text-to-image`, also try without the category filter:

```
WebFetch https://fal.ai/api/models?q={query}&limit=10
```

### Audit mode

For each local model ID, check it against the FAL API using individual lookups or batch:

```
WebFetch https://fal.ai/api/models?endpoint_id={id}
```

Check each model in `ALL_IMAGE_MODELS` and `EDIT_MODELS`.

## Step 4: Present results

### Search mode

Present a table:

```
| endpoint_id              | display_name     | status | In models.ts? |
|--------------------------|------------------|--------|----------------|
| fal-ai/nano-banana-2     | Nano Banana 2    | active | Yes (ALL_IMAGE_MODELS, STORYBOARD_FRAME_MODEL) |
| fal-ai/nano-banana-3     | Nano Banana 3    | active | No             |
```

### Audit mode

Present a table:

```
| Local ID                 | FAL Status | Display Name     | Notes          |
|--------------------------|------------|------------------|----------------|
| fal-ai/flux/schnell      | active     | FLUX Schnell     | OK             |
| fal-ai/old-model         | not found  | -                | STALE - remove |
```

Flag any local IDs that are:

- Not found on FAL (removed/renamed)
- Deprecated
- Have a different canonical name than what's stored locally

## Step 5: If the user wants to add a model

When the user wants to add a model from the search results:

1. Show the exact `endpoint_id` string to use -- copy it verbatim from FAL API results
2. Show where to add it in `models.ts`:
   - Which array (`ALL_IMAGE_MODELS` or `EDIT_MODELS`)
   - What `category` value to use
   - Whether it supports image input (check FAL docs)
3. Remind: if the model is for a specific feature (storyboard, character refs, etc.), add a feature-specific constant using the `.find()!.id` pattern:
   ```ts
   export const MY_FEATURE_MODEL = ALL_IMAGE_MODELS.find(
     (m) => m.id === 'fal-ai/exact-endpoint-id',
   )!.id
   ```

## Key Rules

- **NEVER guess model IDs** -- always use the exact `endpoint_id` from FAL API responses
- All model references in server files MUST import constants from `models.ts` -- never hardcode ID strings in server code
- The `.find()!.id` pattern for feature constants ensures a build-time failure if the ID doesn't exist in the registry
- When in doubt, search FAL first, then write code
