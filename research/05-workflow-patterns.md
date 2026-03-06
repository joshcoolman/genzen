# Workflow Patterns & UX Research

Last Updated: 2026-03-06

---

## 1. Pipeline Archetypes Across AI Image Platforms

AI image platforms have converged on several distinct pipeline patterns. Most platforms support multiple archetypes, but each optimizes for a primary workflow.

### Pipeline Comparison Table

| Pipeline Archetype                       | Primary Platforms                                                | Flow                                                                 | Best For                                  |
| ---------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| **Prompt-and-Pray**                      | Midjourney, Ideogram, DALL-E                                     | Prompt -> batch generate -> pick winner -> re-roll                   | Exploration, inspiration                  |
| **Brainstorm -> Refine -> Upscale**      | Leonardo AI, Freepik Mystic                                      | Generate batch -> select -> Canvas edit -> Alchemy upscale -> export | Production assets                         |
| **Sketch -> Render -> Iterate**          | Krea AI, Playground AI                                           | Draw on canvas -> real-time AI render -> adjust -> export            | Concept art, spatial control              |
| **Describe -> Generate -> Iterate**      | ChatGPT + DALL-E, Ideogram Magic Prompt                          | Upload ref or describe -> AI expands prompt -> generate -> refine    | Users who think visually, not verbally    |
| **Reference -> Generate -> Consistency** | Midjourney (--cref), Leonardo Character Ref, Scenario Multi-LoRA | Upload character ref -> generate scenes -> maintain identity         | Brand assets, storyboards, character work |
| **Node-Based Pipeline**                  | ComfyUI, Runway Workflows, Krea Nodes                            | Chain model nodes visually -> custom multi-stage pipeline            | Power users, batch production             |
| **First-Last-Frame -> Video**            | GenZen, Runway, Kling                                            | Generate first frame -> generate last frame -> interpolate video     | AI video from static images               |

### Platform-Specific Pipeline Details

**Midjourney** operates through a web dashboard (and legacy Discord). The core loop is: craft prompt -> submit -> receive 4-image grid -> select favorite -> upscale or create variations -> remix with parameter tweaks. Key innovations include permutation syntax (`A {red, blue, green} car` spawns 3 jobs automatically) and `--cref` for character locking. Draft Mode enables faster, lower-quality iterations for exploration before committing to full renders. All generations are public by default, creating an ambient discovery feed.

Source: [Midjourney 2026 Guide](https://aitoolsdevpro.com/ai-tools/midjourney-guide/)

**Leonardo AI** follows a more structured production pipeline: Prompt input -> Generation -> AI Canvas editing -> Alchemy upscaling -> batch export -> library storage. Distinguishing features include negative prompts (specify what to exclude), an AI prompt generator that rewrites simple inputs into detailed descriptions, custom model training on brand imagery, and a template library for reusable prompt configurations. The platform targets teams managing asset libraries with consistent outputs.

Source: [Leonardo AI vs Midjourney Comparison](https://aiflowreview.com/leonardo-ai-vs-midjourney-2025-comparison/)

**Krea AI** pioneered the real-time sketch-to-image paradigm. The split-screen canvas shows user input on the left and a live AI render on the right, updating in under 50 milliseconds. The AI Strength slider (0.3-0.9) controls how literally the AI interprets sketches vs. taking creative liberties. At 0.65 (the "sweet spot" for concept art), rough geometric shapes become detailed architectural renders or character concepts. Krea Nodes (2025) added a visual node editor with 50+ model nodes for building custom pipelines.

Source: [Krea AI for Creative Pros](https://chasejarvis.com/blog/krea-ai/)

**Ideogram** differentiates through text rendering (90% accuracy vs. Midjourney's ~30%) and batch generation via CSV upload (up to 500 images). Magic Prompt auto-expands simple inputs into detailed descriptions. Style References accept up to 3 images, and Style Codes let users save/reuse discovered aesthetics from a library of 4.3 billion presets. The "Random" style feature intentionally introduces serendipity.

Source: [Ideogram AI Review 2026](https://pxz.ai/blog/ideogram-ai-review-2026)

**Adobe Firefly** integrates generation into existing creative tools (Photoshop). Generative Fill and Generative Expand operate on selections within existing compositions rather than generating from scratch. The Fill and Expand model doubled resolution to 2K and added reference image support for face/object consistency. This positions generation as an editing tool within established workflows rather than a standalone creation tool.

Source: [Photoshop Firefly Fill and Expand](https://photoshopcafe.com/photoshop-firefly-fill-and-expand-model-new-features-and-comparision/)

**Freepik Mystic** is notable for being a workflow rather than a model. It chains FLUX as the foundation model with fine-tuning, high-resolution upscaling, and parameter optimization into a single "mode" that outputs 2K images without extra steps. Style reference is the key power feature. The platform integrates generation with Freepik's stock library and editing tools (background remover, upscaler, editor) to eliminate tab-switching.

Source: [Freepik Mystic Review](https://www.freepik.com/blog/freepik-mystic/)

**Runway** introduced node-based Workflows (October 2025) allowing users to chain multiple AI models into custom multi-stage pipelines. Gen-4.5 achieves physically accurate motion. Act-Two (July 2025) enables motion-capture-driven character animation from smartphone video. Audio nodes (text-to-speech, SFX, voice dubbing) were added in November 2025, making Runway the most complete video production pipeline.

Source: [RunwayML Review 2025](https://skywork.ai/blog/runwayml-review-2025-ai-video-controls-cost-comparison/)

**ComfyUI** represents the power-user extreme: a node-based visual programming environment where every step (model loading, prompt encoding, sampling, post-processing) is an explicit node with data flowing through edges. 67% of advanced Stable Diffusion users prefer it. It processes images 62% faster than Automatic1111 while using 40% less memory. Community-built nodes integrate new models within days of release.

Source: [ComfyUI GitHub](https://github.com/Comfy-Org/ComfyUI)

---

## 2. Prompt Abstraction Strategies

The core UX challenge: users think visually but must communicate verbally. Platforms use several strategies to bridge this gap.

### Six Prompt Augmentation Patterns

Based on UX research from NNGroup and industry analysis, six distinct patterns help users overcome the "articulation barrier":

| Pattern                           | Description                                                                       | Platform Examples                                                              |
| --------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Style Galleries**               | Visual grid of style options; click to apply                                      | Ideogram (rendering modes), Leonardo (style presets), Playground (style chips) |
| **Prompt Rewrite / Magic Prompt** | AI auto-expands simple input into detailed prompt                                 | Ideogram Magic Prompt, Leonardo AI Prompt Generator, DALL-E prompt enhancement |
| **Targeted Rewrite**              | AI improves specific aspects (lighting, composition) while preserving user intent | ChatGPT 4o image editing, Adobe Firefly Generative Fill                        |
| **Related Prompts**               | System suggests variations of user's prompt                                       | GenZen "More" variations (Claude generates 2 variant prompts)                  |
| **Visual Prompt Builders**        | Structured UI with dropdowns/sliders replacing free text                          | Higgsfield lens selector, Krea AI Strength slider                              |
| **Parametrization**               | Expose specific controls (aspect ratio, style weight, chaos) as named parameters  | Midjourney `--ar`, `--stylize`, `--chaos`, `--weird`                           |

Source: [Prompt Augmentation UX Patterns](https://www.uxtigers.com/post/prompt-augmentation)

### Camera and Cinematography Controls

Higgsfield Cinema Studio is the leading example of replacing text prompts with structured cinematographic inputs. Users select:

- **Lens focal length**: 35mm (environmental), 50mm (balanced), 85mm (portrait/product)
- **Camera movement presets**: 20+ options including dolly-in, orbit, crane-up, FPV drone sweep
- **Focus behavior**: Selective depth-of-field with rack focus transitions
- **Movement dynamics**: Realistic inertia and speed curves

The key insight: users describe movement intent in natural language, and the engine translates it into lens behavior that follows cinematic conventions. No sliders or numeric coordinates needed.

Source: [Higgsfield Cinema Studio](https://higgsfield.ai/cinematic-video-generator), [WAN Camera Control Guide](https://higgsfield.ai/blog/WAN-AI-Camera-Control-Your-Guide-to-Cinematic-Motion)

### Prompt Enhancement as Default Behavior

Multiple platforms now auto-enhance prompts by default:

- **Ideogram Magic Prompt**: "coffee cup" becomes "a steaming ceramic coffee cup on a wooden table, soft morning light streaming through a window, warm tones, shallow depth of field"
- **Leonardo AI Prompt Generator**: Writes prompts or improves existing ones with detail and specificity
- **Freepik Mystic**: Parameter optimization happens within the workflow pipeline itself
- **DALL-E / ChatGPT 4o**: Rewrites user prompts before generation (sometimes controversially, when it overrides intent)

The pattern: auto-enhancement should be transparent and overridable. Users who write detailed prompts want them respected; users who write simple prompts benefit from expansion.

---

## 3. Engagement Loops and "Fiddle-ability"

### The Four Stages of AI Image Generation

Nielsen Norman Group identified four stages through contextual inquiry research with image generation users:

| Stage          | Activity                            | Time Spent         | Key Insight                                                                                                         |
| -------------- | ----------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **1. Define**  | Establish goal, overcome blank page | Low                | Users reference past images, chatbots, or prompt libraries to start                                                 |
| **2. Explore** | Generate 20-80 images per session   | High               | "AI-generated ideas often came as a pleasant surprise" -- users discover better concepts than their original vision |
| **3. Refine**  | Tweak specific details              | High (frustrating) | Greatest pain point: "Midjourney is a generator, not an editor" -- limited control over small adjustments           |
| **4. Export**  | Finalize, upscale, add text         | Low                | Often happens in external tools (Photoshop)                                                                         |

Source: [NN/G: 4 Stages of AI Image Generation](https://www.nngroup.com/articles/ai-imagegen-stages/)

**Inspiration-oriented users** spend time in Define/Explore and may never reach Refine/Export.
**Deliverable-oriented users** spend most time in Refine/Export and experience the most friction.

### What Makes Tools "Fiddle-able"

Based on cross-platform analysis, the most engaging AI image tools share these characteristics:

**1. Fast Iteration Cycles**

- Krea's sub-50ms real-time rendering eliminates wait time entirely
- Ideogram 2a Turbo generates in ~5 seconds vs. Midjourney's 30-60 seconds
- Midjourney Draft Mode trades quality for speed during exploration
- Pattern: reduce time-to-result below the "context switch threshold" (~10 seconds)

**2. Surprise and Serendipity by Design**

- Ideogram's Random style explores 4.3 billion style presets
- Midjourney's `--chaos` parameter intentionally increases variation
- CHI 2025 research found that "embracing the serendipity of genAI-generated 'happy accidents' enhanced the richness of design exploration"
- Users generate 20-80 images per session specifically to increase the probability of surprising results
- Pattern: build in controlled randomness as a feature, not a bug

Source: [CHI 2025: Creative Reflections on Image-Making with AI](https://dl.acm.org/doi/10.1145/3706598.3713529)

**3. Low-Cost Exploration**

- Generous free tiers or "relax mode" unlimited generation (Midjourney)
- Per-image pricing low enough to encourage experimentation
- Pattern: make the marginal cost of "one more try" feel negligible

**4. Visual Feedback Over Text Feedback**

- Krea's live canvas updates provide continuous visual feedback
- Midjourney's 4-image grid enables visual comparison
- Pattern: show results visually, not through status messages

**5. Shareable Results as Social Currency**

- Midjourney's default-public model creates ambient discovery
- Community galleries serve as both inspiration and prompt libraries
- Pattern: the desire to share drives more generation cycles

**6. Compositional Control**

- Layer-based editing (recommended by UX Studio research)
- Lasso-style selection for targeted regeneration (Adobe Generative Fill)
- Reusable object/character systems for consistency
- Pattern: give users control over what stays and what changes

Source: [Improving Image Generation AI to Inspire Creativity](https://www.uxstudioteam.com/ux-blog/improving-image-generation-ai)

### The "Slot Machine" vs. "Paintbrush" Spectrum

Krea AI's approach reframes this tension: traditional AI image tools operate like "slot machines" (pull the lever, hope for the best), while interactive tools operate like "paintbrushes" (continuous control, immediate feedback). The most engaging tools find a middle ground -- enough randomness to surprise, enough control to direct.

Source: [Krea AI for Creative Pros](https://chasejarvis.com/blog/krea-ai/)

---

## 4. Multi-Image Workflows

### Character Consistency Approaches

| Approach                       | Platform              | How It Works                                                         | Consistency Level                             |
| ------------------------------ | --------------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| **Character Reference Tags**   | Midjourney `--cref`   | Upload reference image URL; AI matches face, body, clothing          | Moderate (features preserved, styling varies) |
| **Character Reference Upload** | Leonardo AI           | Upload headshots; system maintains identity across generations       | Moderate-High                                 |
| **Multi-LoRA Composition**     | Scenario              | Train separate LoRA per character; compose in scene                  | High (requires training step)                 |
| **Conversational Session**     | ChatGPT 4o            | Keep character in conversation context; reference across generations | 87% higher consistency than separate sessions |
| **Custom Model Training**      | Leonardo AI, Scenario | Fine-tune on brand/character imagery                                 | Highest (requires dataset)                    |
| **Style Codes**                | Ideogram              | Save reusable style identifiers; apply to any prompt                 | Style consistency only (not character)        |

Source: [Midjourney Character Consistency](https://venturebeat.com/ai/midjourney-debuts-feature-for-generating-consistent-characters-across-multiple-gen-ai-images), [Scenario Multi-Character Scenes](https://help.scenario.com/en/articles/generate-multi-character-scenes/)

### Style Transfer Between Images

- **Midjourney `--sref`**: Feed external visual references to influence generation style
- **Ideogram Style Reference**: Upload up to 3 reference images to control aesthetic
- **Freepik Mystic Style Reference**: "Possibly the most powerful tool" -- enables unique image creation by guiding aesthetic
- **Krea AI Patterns**: Embed logos/brand elements subtly within photographic scenes

### Storyboarding Tools

**Storyboarder.ai** is a dedicated storyboarding platform that maintains character consistency and cohesive art style across entire storyboards. Users can upload their own style as an image, and the platform transforms all frames to match.

**Runway Act-Two** enables motion-capture-driven character animation -- upload a driving performance video and a character reference image, and the system generates video of that character performing those actions.

**GenZen's current FLF workflow** (first frame -> last frame -> video) is a lightweight storyboarding primitive: define two key moments, interpolate between them.

### Batch Operations

- **Midjourney Permutation Syntax**: `A {red, blue, green} car in a {city, desert, forest}` spawns 9 jobs automatically
- **Ideogram CSV Batch**: Upload spreadsheet with 500 prompts, generate all
- **Leonardo Batch Processing**: Generate multiple image variants simultaneously
- **ComfyUI Batch Nodes**: Programmatic batch processing with full pipeline control

---

## 5. Simplification Strategies

### Interface Paradigms

| Paradigm                  | Platforms                             | Pros                                        | Cons                                   |
| ------------------------- | ------------------------------------- | ------------------------------------------- | -------------------------------------- |
| **Single-Page Generator** | Ideogram, GenZen, DALL-E              | Low friction, fast to start                 | Limited advanced controls              |
| **Canvas/Editor**         | Krea, Playground, Leonardo AI Canvas  | Spatial control, post-generation editing    | Steeper learning curve                 |
| **Chat-Based**            | ChatGPT 4o, Gemini                    | Natural language, conversational refinement | Hard to express spatial/visual intent  |
| **Discord/CLI**           | Midjourney (legacy)                   | Community discovery, shareable              | High entry barrier, no visual controls |
| **Node-Based**            | ComfyUI, Runway Workflows, Krea Nodes | Maximum flexibility, composable pipelines   | Requires technical understanding       |
| **Integrated Suite**      | Adobe Firefly (in Photoshop), Freepik | Fits existing workflows                     | Tied to parent platform                |

### Progressive Disclosure in Practice

The most effective platforms layer complexity across 2-3 tiers:

**Tier 1 -- Immediate (visible by default):**

- Text prompt input
- Generate button
- Model selector (if multiple)
- Aspect ratio

**Tier 2 -- One Click Away (expandable panel):**

- Negative prompts
- Style/rendering mode
- Guidance/creativity scale
- Seed control
- Reference image upload

**Tier 3 -- Power User (separate view or mode):**

- Node-based workflow editor
- Custom model training
- API access
- Batch/CSV operations
- LoRA composition

Source: [Progressive Disclosure in AI Interfaces](https://aipositive.substack.com/p/progressive-disclosure-matters)

**Practical examples:**

- **Ideogram**: Clean prompt box + style selector (Tier 1) -> rendering modes, aspect ratio, Magic Prompt toggle (Tier 2) -> CSV batch, API (Tier 3)
- **Leonardo AI**: Prompt + generate (Tier 1) -> negative prompts, creativity slider, style presets (Tier 2) -> custom model training, Canvas editor (Tier 3)
- **Krea AI**: Prompt + canvas + generate (Tier 1) -> AI Strength slider, node connections (Tier 2) -> full Krea Nodes pipeline editor (Tier 3)

### Opinionated Defaults vs. Full Control

Platforms take different positions on this spectrum:

**Highly Opinionated (fewer knobs):**

- ChatGPT 4o: no model selection, no parameters, just describe what you want
- Freepik Mystic: the "workflow" makes all optimization decisions internally
- DALL-E: minimal controls, prompt is everything

**Balanced:**

- Ideogram: sensible defaults + Magic Prompt, with rendering modes and reference images available
- GenZen: model picker + aspect ratio + brainstorm mode, with "More" variations for refinement
- Leonardo AI: presets and templates reduce decision fatigue while exposing controls

**Full Control:**

- Midjourney: 20+ parameters available via flags
- ComfyUI: every pipeline step is explicit and configurable
- Krea Nodes: full visual programming environment

### Mobile vs. Desktop

Most platforms are desktop-first due to the visual nature of the work, but mobile is growing:

- Midjourney launched iOS/Android apps in 2025
- Ideogram has an official iOS app
- Krea and Leonardo remain desktop-focused
- Adobe Firefly Mobile supports Generative Expand on mobile

The mobile pattern is: simplified generation (Tier 1 controls only) for on-the-go ideation, with full editing reserved for desktop.

---

## Implications for GenZen

### Strengths to Build On

1. **Brainstorm mode is already a pipeline archetype.** Multi-prompt batch generation maps to the Explore stage where users generate 20-80 images. GenZen's approach of generating multiple prompts at once is more intentional than Midjourney's single-prompt grid.

2. **"More" variations are a strong engagement loop.** AI-suggested variations using Kontext align with the "Related Prompts" augmentation pattern and keep users in the Explore stage without manual prompt iteration.

3. **FLF video workflow is a unique pipeline.** First-frame -> last-frame -> video is a lightweight storyboarding primitive that no major competitor offers in this exact form.

4. **Model picker with 18 models is a power feature.** Similar to ComfyUI's model flexibility but with GenZen's simpler interface.

### Opportunities Identified

1. **Prompt Enhancement / Magic Prompt**: Auto-expand simple prompts into detailed descriptions (every major competitor offers this). Could leverage the existing Claude integration that powers "More" variations. This is the single highest-impact UX improvement for reducing the articulation barrier.

2. **Progressive Disclosure**: GenZen currently shows model picker + aspect ratio on the main view. Consider a collapsible "Advanced" panel for negative prompts, creativity/guidance scale, and seed control. Keep the default experience clean.

3. **Real-Time or Fast Preview**: Krea's sub-50ms real-time rendering is the gold standard for fiddle-ability. Even without real-time, showing low-quality previews before committing to full generation would reduce the "slot machine" feeling.

4. **Style Reference System**: Ideogram (3 reference images), Freepik Mystic (style reference), and Midjourney (`--sref`) all support this. GenZen's Edit Image already supports multi-reference -- extending this to main generation would be natural.

5. **Character Consistency**: The biggest gap in single-session AI image tools. Midjourney's `--cref` and Leonardo's Character Reference are the minimum viable approaches. GenZen's Kontext-based variations could be extended to maintain character identity across generations.

6. **Serendipity Features**: A "Surprise Me" or random style mode (like Ideogram's Random) would increase engagement during exploration. Low implementation cost, high fiddle-ability payoff.

7. **Canvas/Spatial Editing**: Post-generation editing (inpainting, outpainting) is becoming table stakes. GenZen has Outpaint in R&D -- promoting this to a core feature would address the Refine stage pain point identified by NN/G research.

8. **Batch/Permutation Generation**: Midjourney's permutation syntax and Ideogram's CSV batch are power-user features that dramatically increase throughput for production workflows.

### Priority Recommendations

| Priority | Feature                                 | Rationale                                               | Complexity                     |
| -------- | --------------------------------------- | ------------------------------------------------------- | ------------------------------ |
| **P0**   | Prompt enhancement (auto-expand)        | Every competitor has this; biggest UX gap               | Low (reuse Claude integration) |
| **P1**   | Style reference in main generation      | Table stakes for 2026; extends existing Edit Image refs | Medium                         |
| **P1**   | Promote Outpaint to core feature        | Addresses #1 pain point (refine stage)                  | Medium (already in R&D)        |
| **P2**   | Character reference / consistency       | Growing user expectation; competitive necessity         | Medium-High                    |
| **P2**   | Progressive disclosure (advanced panel) | Enables power features without cluttering default UX    | Low                            |
| **P3**   | Random/Surprise style mode              | High engagement, low effort                             | Low                            |
| **P3**   | Batch generation / permutations         | Production workflow feature                             | Medium                         |
