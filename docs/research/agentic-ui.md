# Agentic UI

Vision document for GenZen's evolution from traditional click-navigate-submit UI to conversational, agent-driven workflows.

## The Shift

**Old way:** User navigates to a page, fills in inputs, clicks buttons, copies outputs, pastes them into another tool, repeats.

**New way:** User talks to AD (Assistant Director). AD sees what the user sees, understands context, executes actions, assembles UI on the fly, and chains tools together -- all within a conversation.

The traditional UI doesn't disappear. It becomes one of two interfaces: direct manipulation for when you want it, conversation for when you don't.

## Three Layers

### Layer 1: AD as Actor (Conversational Control)

AD already lives in the sidebar. Today it advises. The gap: it can't _act_.

Give AD the ability to call the same functions the UI calls -- generate an image, add to canvas, delete a prompt, run a comparison. The conversation becomes the interface.

Example: "I really like images 7 and 2. Generate some poster concepts combining those styles." AD sees the screen, identifies the images, generates prompts, triggers generation, and results appear in the gallery.

### Layer 2: Features as API Endpoints (Headless Capabilities)

Each capability becomes a clean input/output contract exposed as a Nitro h3 route:

- `/api/tools/generate-image` -- prompt in, image out
- `/api/tools/remove-background` -- image in, image out
- `/api/tools/outpaint` -- image + aspect ratio in, extended image out
- `/api/tools/upscale` -- image in, high-res image out
- `/api/tools/variations` -- image in, variation images out

These don't care who's calling -- the GenZen UI, AD, or an external agent. Same endpoint, same contract. Authentication and rate limiting at the edge.

This is the keystone layer. It unlocks both internal agentic use (Layer 3) and external consumption simultaneously.

### Layer 3: Generative UI (Dynamic Composition)

Inspired by [vercel-labs/json-render](https://github.com/vercel-labs/json-render).

Instead of building a page for every workflow, AD composes UI on the fly from a catalog of known components. The AI outputs a JSON spec, a renderer turns it into real React components.

**Component catalog** (Zod-described, AI-accessible):

- ImageCard, ImageGrid
- PromptInput, ModelSelector
- GenerateButton, CompareView
- Canvas (spatial layout)

**Example flow:**

1. User: "I want to compare nano banana outputs across Kling and Grok with four prompts, side by side."
2. AD composes a layout: four prompt inputs, two image outputs per row, a Run button
3. JSON spec streams in, renderer materializes the UI
4. User runs it, sees results
5. User: "Save this as a tool I can use later"
6. The composed UI persists as a named workflow/template

### Workflow Persistence

Composed UIs aren't throwaway. They become reusable artifacts -- like saved queries, but for entire mini-apps. A user builds up a personal toolkit of workflows over time.

## Where This Connects to What Exists

| Existing piece                  | Role in agentic future                                         |
| ------------------------------- | -------------------------------------------------------------- |
| AD sidebar (`src/features/ad/`) | Becomes the primary agent interface                            |
| FAL integration                 | Powers the tool endpoints                                      |
| Canvas (`src/features/canvas/`) | Becomes AD's spatial workspace                                 |
| Multi-Model grid                | A pre-built "workflow" that could also be composed dynamically |
| Scenes (3x3 variations)         | Another composable workflow pattern                            |
| shadcn components               | Foundation of the component catalog                            |
| Nitro h3 routes (`server/api/`) | Where tool endpoints live                                      |
| R2 storage                      | Where generated artifacts land                                 |

## Smallest First Steps

Two viable entry points (not mutually exclusive):

1. **Agent-first:** Give AD one real tool (generate-image endpoint) and wire it so AD can trigger generation from conversation. Proves the agent loop.

2. **Composition-first:** Adopt json-render, define a small component catalog, and have AD build a simple layout on the fly. Proves the dynamic UI concept.

## Open Questions

- How does auth/credit metering work for API endpoints exposed externally?
- What's the persistence model for saved workflows? Supabase table? JSON in R2?
- How does AD's context window handle seeing the current screen state + conversation + tool catalog?
- Should workflows be shareable between users?
- How does this relate to the revenue/payments gate? Is the API surface itself a product?

---

_Started 2026-03-29. Living document -- update as the vision sharpens._
