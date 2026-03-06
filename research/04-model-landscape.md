# Model & Platform Landscape

Last Updated: 2026-03-06

## GenZen's Current Model Catalog

### Text-to-Image (18 models via FAL)

| Model            | Provider          | Key Strength                                |
| ---------------- | ----------------- | ------------------------------------------- |
| FLUX Schnell     | Black Forest Labs | Fast iteration                              |
| FLUX Dev         | Black Forest Labs | Open-source development                     |
| FLUX 2 Pro       | Black Forest Labs | Production photorealism                     |
| FLUX 2 Flex      | Black Forest Labs | Configurable parameters                     |
| FLUX Kontext Pro | Black Forest Labs | Text-guided editing + generation            |
| FLUX LoRA Stream | Black Forest Labs | Custom fine-tuned generation                |
| Kling v3         | Kuaishou          | Image generation + video pipeline           |
| Kling Omni 3     | Kuaishou          | Multi-modal generation                      |
| Seedream v4      | ByteDance         | High-fidelity, text rendering               |
| Nano Banana      | Google DeepMind   | Multimodal native generation                |
| Nano Banana Pro  | Google DeepMind   | Higher quality, Gemini 3 Pro backbone       |
| Nano Banana 2    | Google DeepMind   | Speed + quality (Flash-tier)                |
| Recraft V3       | Recraft           | Best-in-class text rendering, vector output |
| Grok Imagine     | xAI               | FLUX-based, minimal content filtering       |
| ImagineArt 1.5   | ImagineArt        | General purpose                             |
| Bria FIBO        | Bria              | Licensed training data, commercial-safe     |
| Qwen Image       | Alibaba           | Multimodal generation                       |
| SD 3.5 Large     | Stability AI      | Open-source, LoRA/ControlNet ecosystem      |

### Edit Models (8)

| Model                | Provider          | Capabilities                                              |
| -------------------- | ----------------- | --------------------------------------------------------- |
| GPT Image 1.5        | OpenAI            | Best prompt adherence, text rendering, mask-based editing |
| Nano Banana Edit     | Google            | Multimodal editing with conversation                      |
| Nano Banana Pro Edit | Google            | Higher quality edits                                      |
| Nano Banana 2 Edit   | Google            | Fast edits, 5-character consistency                       |
| FLUX.2 Pro Edit      | Black Forest Labs | Production editing, multi-reference                       |
| FLUX.2 Flex Edit     | Black Forest Labs | Configurable editing                                      |
| Seedream v4 Edit     | ByteDance         | Subject-preserving edits                                  |
| Seedream v4.5 Edit   | ByteDance         | Multi-image editing, typography                           |

### Video (Current)

| Model    | Provider | Capabilities                              |
| -------- | -------- | ----------------------------------------- |
| Kling O1 | Kuaishou | First-last-frame workflow, image-to-video |

---

## Cross-Platform Model Availability

Models available on multiple inference platforms represent more stable, long-term bets. Platform-exclusive models carry higher lock-in risk.

### Multi-Platform Models (Stable Bets)

| Model            | FAL | Replicate | Fireworks     | Together | Azure/Vertex |
| ---------------- | --- | --------- | ------------- | -------- | ------------ |
| FLUX 2 Pro/Max   | Yes | Yes       | Yes (Kontext) | No       | Yes (Azure)  |
| FLUX Kontext Pro | Yes | Yes       | Yes           | No       | Yes (Azure)  |
| FLUX Dev/Schnell | Yes | Yes       | Yes           | Yes      | No           |
| SD 3.5 Large     | Yes | Yes       | Yes           | Yes      | Yes (Azure)  |
| Recraft V3       | Yes | Yes       | No            | No       | No           |
| GPT Image 1.5    | Yes | Yes       | No            | No       | Yes (Azure)  |
| Sora 2           | Yes | No        | No            | No       | Retiring     |
| Kling 3.0        | Yes | Yes       | No            | No       | No           |

### Platform-Exclusive or Limited

| Model         | Primary Platform        | Notes                                                       |
| ------------- | ----------------------- | ----------------------------------------------------------- |
| Midjourney v7 | Discord only            | No official API. Third-party wrappers exist but violate ToS |
| Ideogram 3.0  | Ideogram API, Replicate | Not on FAL                                                  |
| Nano Banana 2 | Google Gemini API, FAL  | Google-first, expanding                                     |
| Seedream 5.0  | FAL (Lite), WaveSpeedAI | ByteDance expanding distribution                            |
| DALL-E 3.5    | OpenAI API              | Not available on aggregators                                |
| Veo 3.1       | FAL, Google Vertex AI   | Google-controlled distribution                              |

### Platform Summary

| Platform        | Strength                            | Model Count   | Focus                     |
| --------------- | ----------------------------------- | ------------- | ------------------------- |
| **FAL**         | Broadest catalog, fastest GPU infra | 600+          | Image, video, audio, 3D   |
| **Replicate**   | Community models, custom deploys    | ~200          | Broad but smaller catalog |
| **Fireworks**   | Low-latency LLM inference           | Limited image | Primarily language models |
| **Together AI** | Open-source LLMs                    | Limited image | Primarily language models |
| **WaveSpeedAI** | Emerging competitor to FAL          | Growing       | Image, video focus        |

**Assessment:** FAL remains the strongest single-provider bet for GenZen. Its day-zero availability of major models (Kling 3.0, Sora 2, Veo 3.1, LTX 2.0) and $125M Series C funding signal continued investment. WaveSpeedAI is the most credible emerging alternative.

---

## New Capabilities Shipping Across the Industry

### Native Image Editing (Beyond img2img)

The editing landscape has matured significantly. Key developments:

| Model                | Editing Approach                | Standout Feature                                           |
| -------------------- | ------------------------------- | ---------------------------------------------------------- |
| FLUX Kontext Pro/Max | Text-guided, reference-aware    | 0.9s per edit on A100, 8x faster than competitors          |
| GPT Image 1.5        | Conversational, mask-based      | Best prompt adherence, 4x faster than GPT Image 1          |
| Seedream 4.5         | Multi-subject reference editing | Up to 10 reference images, accurate subject identification |
| Nano Banana 2        | Native multimodal               | Edit within conversation flow, 5 characters + 14 objects   |
| Ideogram 3.0         | Inpainting + reframing          | Style-consistent outpainting with aspect ratio adaptation  |

**GenZen position:** Strong coverage with 8 edit models. FLUX Kontext and GPT Image 1.5 are best-in-class. Gap: no Ideogram editing integration.

### Multi-Reference / Character Consistency

This was the biggest capability leap in 2025-2026. Models now maintain character identity across generations:

| Model         | Max References           | Consistency Method                        |
| ------------- | ------------------------ | ----------------------------------------- |
| FLUX.2 Max    | 10 images                | Grounded generation with web context      |
| Nano Banana 2 | 5 characters, 14 objects | Mathematical fingerprint embedding        |
| Seedream 4.5  | 10 reference images      | Batch generation consistency              |
| Midjourney v7 | Character ref (--cref)   | Reference image locking                   |
| Runway Gen-4  | Reference image system   | Cross-shot character preservation (video) |

**GenZen position:** Covered via FLUX.2 and Nano Banana models. Seedream 4.5 Edit adds multi-subject reference. This is a key differentiator to surface in the UI.

### Text Rendering in Images

| Model         | Text Accuracy | Long Text          | Positioned Text               |
| ------------- | ------------- | ------------------ | ----------------------------- |
| Recraft V3    | ~98%          | Yes (paragraphs)   | Yes (size + position control) |
| Ideogram 3.0  | ~95%          | Yes                | Yes (style refs)              |
| GPT Image 1.5 | ~95%          | Yes (dense, small) | Via prompt                    |
| Seedream 5.0  | High          | Yes                | Emerging                      |
| DALL-E 3.5    | ~95%          | Moderate           | Via prompt                    |
| FLUX 2 Pro    | Moderate      | Short phrases      | No                            |

**GenZen position:** Recraft V3 is the strongest text model in the catalog. Gap: Ideogram 3.0 is not integrated but would add style-reference text rendering.

### Inpainting / Outpainting

| Model                | Inpainting        | Outpainting | Notes                                    |
| -------------------- | ----------------- | ----------- | ---------------------------------------- |
| FLUX Fill (1.0 Dev)  | Yes               | Yes         | Open-access, mask-based                  |
| FLUX Kontext Pro     | Yes (text-guided) | No          | Edit-by-instruction                      |
| GPT Image 1.5        | Yes (mask-based)  | Yes         | Conversational editing                   |
| Ideogram 3.0 Reframe | No                | Yes         | Style-consistent aspect ratio adaptation |
| Nano Banana 2        | Yes               | Yes         | Multimodal conversation flow             |

**GenZen position:** Covered through FLUX and GPT Image models. The R&D outpaint page suggests active development here.

---

## Video Model Landscape

The video generation market underwent a major transformation in 2025-2026. Four tiers have emerged:

### Tier 1: Production-Grade (Native Audio, 4K)

| Model        | Provider  | Resolution | Duration               | Audio                 | Key Feature                                |
| ------------ | --------- | ---------- | ---------------------- | --------------------- | ------------------------------------------ |
| Kling 3.0    | Kuaishou  | 4K @ 60fps | Multi-shot             | Native                | Storyboard, 6 camera cuts per generation   |
| Veo 3.1      | Google    | Up to 4K   | 60s+ (scene extension) | Native                | Best overall quality, Gemini API           |
| Sora 2       | OpenAI    | 1080p      | Variable               | Native                | Highest fidelity storytelling              |
| Seedance 2.0 | ByteDance | 2K         | 15s                    | Native (8+ languages) | Multi-modal refs (9 img + 3 vid + 3 audio) |

### Tier 2: Professional Tools

| Model        | Provider | Resolution | Duration | Audio           | Key Feature                             |
| ------------ | -------- | ---------- | -------- | --------------- | --------------------------------------- |
| Runway Gen-4 | Runway   | 1080p      | Variable | No              | Best character consistency across shots |
| Kling 2.6    | Kuaishou | 1080p      | 10s      | Native (on FAL) | Mature, well-priced                     |
| Pika 2.5     | Pika     | 1080p      | Short    | No              | Fast social-ready clips                 |
| Luma Ray3    | Luma     | 1080p      | Short    | No              | Fastest generation, HDR/EXR export      |

### Tier 3: Open Source / Self-Hostable

| Model            | Provider   | Resolution | Duration | Key Feature                                |
| ---------------- | ---------- | ---------- | -------- | ------------------------------------------ |
| LTX 2.3          | Lightricks | 1080p      | Variable | Text/image/audio-to-video, fast            |
| Wan 2.1/2.6      | Alibaba    | Variable   | Variable | 14B params, multilingual, 8GB VRAM minimum |
| HunyuanVideo 1.5 | Tencent    | 1080p      | Variable | 8.3B params, consumer GPU capable          |
| Mochi 1          | Genmo      | 1080p      | Short    | Open state-of-the-art                      |

### FAL Video Catalog (Currently Available)

| Model                     | Modes               | Pricing (per second)        |
| ------------------------- | ------------------- | --------------------------- |
| Kling 3.0                 | T2V, I2V            | ~$0.029                     |
| Veo 3.1                   | T2V                 | ~$0.29                      |
| Sora 2                    | T2V, I2V, V2V remix | $0.30 (720p), $0.50 (1080p) |
| LTX 2.0                   | T2V, I2V            | Low (open model)            |
| Kling 2.6                 | T2V, I2V            | ~$0.02                      |
| MiniMax (Hailuo) Video 01 | T2V, I2V            | Moderate                    |
| Luma Dream Machine 1.5    | I2V                 | Moderate                    |
| HunyuanVideo              | T2V                 | Low (open model)            |
| Mochi 1                   | T2V                 | Low (open model)            |
| PixVerse v4.5             | T2V, I2V            | Moderate                    |
| Wan 2.2                   | I2V                 | Low                         |

**GenZen position:** Currently limited to Kling O1 with first-last-frame workflow. Massive opportunity to expand. Kling 3.0 is the obvious next add (already on FAL, cheapest per-second, 4K native). Sora 2 and Veo 3.1 offer premium tiers. LTX 2.0 offers a cost-effective open option.

---

## Provider Direction Signals

### Black Forest Labs (FLUX)

- **Trajectory:** From open-source disruptor to full commercial platform. $3.25B valuation.
- **Recent:** FLUX.2 family (Max, Pro, Flex, Klein) launched Q1 2026. Klein is fastest-ever model.
- **Strategy:** Multi-tier pricing (Klein for prototyping, Pro for production, Max for premium). Grounded generation (web search context) is a unique differentiator.
- **Signal:** FLUX.2 Max supports 10 reference images with web grounding -- moving toward agentic image generation.

Sources: [Black Forest Labs](https://bfl.ai/), [FLUX.2 Max on Replicate](https://replicate.com/black-forest-labs/flux-2-max)

### Google (Imagen / Nano Banana / Veo)

- **Trajectory:** Consolidating around Nano Banana as the multimodal generation layer, with Imagen 4 as the specialized diffusion backbone.
- **Recent:** Nano Banana 2 (Feb 2026) combines Pro quality with Flash speed. Veo 3.1 vertical video for Shorts.
- **Strategy:** Nano Banana is the consumer-facing brand (Gemini, Search, Ads). Imagen 4 is the specialized photorealism engine underneath. Veo for video.
- **Signal:** Google is the only provider with generation embedded across search, ads, and consumer products. Enterprise access via Vertex AI.

Sources: [Nano Banana 2 announcement](https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/), [Veo 3.1 on Google Developers Blog](https://developers.googleblog.com/introducing-veo-3-1-and-new-creative-capabilities-in-the-gemini-api/)

### ByteDance (Seedream / Seedance)

- **Trajectory:** Aggressive expansion from TikTok-internal tooling to open API provider.
- **Recent:** Seedream 5.0 (Feb 2026) adds web search grounding and 4K native. Seedance 2.0 (Feb 2026) is first native audio+lip-sync video model.
- **Strategy:** Leveraging TikTok distribution. Models optimized for social content creation.
- **Signal:** Hollywood training data disputes may slow Seedance 2.0 API availability. Seedream 5.0 Lite already on FAL.

Sources: [Seedream 5.0 Lite on FAL](https://blog.fal.ai/), [CNBC on Seedance 2.0](https://www.cnbc.com/2026/02/14/new-china-ai-models-alibaba-bytedance-seedance-kuaishou-kling.html)

### Kuaishou (Kling)

- **Trajectory:** Fastest-improving video model family. From Kling 1.0 to 3.0 in ~18 months.
- **Recent:** Kling 3.0 (Feb 2026) delivers 4K@60fps, storyboard multi-shot, start+end frame control.
- **Strategy:** Aggressive pricing ($0.029/s on FAL) and day-zero platform availability. Dual image+video generation.
- **Signal:** Kling is becoming the "FLUX of video" -- the default API choice for developers due to quality/price ratio.

Sources: [Kling 3.0 on FAL](https://blog.fal.ai/), [Kling 3.0 review](https://www.readability.com/kling-3-0-and-kling-motion-control-the-future-of-ai-video-creation-in-2026)

### OpenAI (GPT Image / Sora)

- **Trajectory:** From standalone models to integrated multimodal system.
- **Recent:** GPT Image 1.5 (Dec 2025) -- 4x faster, 20% cheaper, best editing precision. Sora 2 available on FAL.
- **Strategy:** Image generation as a feature of ChatGPT/API rather than standalone product. Sora 2 pricing signals premium positioning.
- **Signal:** Sora original retiring from Azure (Feb 2026). OpenAI consolidating around Sora 2 + GPT Image 1.5.

Sources: [GPT Image 1.5 announcement](https://openai.com/index/new-chatgpt-images-is-here/), [Sora 2 on FAL](https://blog.fal.ai/sora-2-gpt-image-1-are-now-available-on-fal/)

### Stability AI (Stable Diffusion)

- **Trajectory:** Pivoting from open-source model releases to enterprise partnerships.
- **Recent:** Stable Video 4D 2.0 for 3D-aware video. SD 3.5 Large on Azure AI Foundry. Strategic partnership with WPP.
- **Strategy:** Enterprise licensing and partnerships rather than direct API competition.
- **Signal:** SD 4 / SDXL Turbo v2 referenced but no major consumer-facing releases in early 2026. Community ecosystem (LoRA, ControlNet) remains SD's moat.

Sources: [Stability AI News](https://stability.ai/news), [SD 3.5 guide](https://aitoolsdevpro.com/ai-tools/stable-diffusion-guide/)

### Midjourney

- **Trajectory:** Premium creative tool expanding beyond Discord.
- **Recent:** Niji 7 (Jan 2026) for anime. Video generation V1 (up to 21s). Web editor with generative fill.
- **Strategy:** Aesthetic quality leadership. Moving to web-based editor. Enterprise API survey signals future API availability.
- **Signal:** Still no official API. This limits integration opportunities for platforms like GenZen. When/if an API launches, it would be a high-value addition.

Sources: [Midjourney API status](https://wedding.alibaba.com/question/does-midjourney-have-an-api-official-statement), [Midjourney review](https://www.eesel.ai/blog/midjourney)

---

## FAL Catalog Trajectory

### Recent Additions (Q1 2026)

| Date         | Model                                                 | Category         |
| ------------ | ----------------------------------------------------- | ---------------- |
| Mar 2, 2026  | HeyGen (Video Agent API, avatars, lip sync)           | Video / Avatars  |
| Feb 25, 2026 | Seedream 5.0 Lite                                     | Image Generation |
| Feb 5, 2026  | Kling 3.0                                             | Video + Image    |
| Jan 29, 2026 | Grok Imagine (5 endpoints: gen + edit, image + video) | Image + Video    |
| Jan 6, 2026  | LTX 2.0                                               | Video            |
| Late 2025    | Sora 2, GPT Image 1.5, Veo 3.1                        | Video + Image    |
| Late 2025    | Kling 2.6 (exclusive, native audio)                   | Video            |

### Growth Categories

1. **Video generation** -- Fastest-growing category. From ~3 models in early 2025 to 10+ in early 2026.
2. **Multi-modal generation** -- Grok Imagine (5 endpoints), Nano Banana family, Seedream expanding from image-only to edit+video.
3. **Avatar / talking head** -- HeyGen integration signals FAL moving into avatar/lip-sync territory.
4. **3D generation** -- HunyuanVideo 3D v2.1 endpoint visible in model catalog.
5. **Audio** -- Chatterbox Turbo TTS model added for voice generation.

### Platform Infrastructure

- 1000+ model endpoints, 600+ unique models
- $125M Series C funding (2025)
- Custom tagging system for model organization (Feb 2026)
- Context parallelism and kernel optimization for faster inference

---

## Capability Maturity Matrix

Rating scale:

- **Mature** = Production-ready in GenZen, multiple model options, well-understood quality
- **Emerging** = Available but limited model selection, or recently added without deep integration
- **Available** = Models exist on FAL but not integrated into GenZen
- **Missing** = No models in GenZen catalog, available elsewhere

| Capability                   | GenZen Status | Models in Catalog                    | Best Available (Not in GenZen)            | Assessment                                                            |
| ---------------------------- | ------------- | ------------------------------------ | ----------------------------------------- | --------------------------------------------------------------------- |
| Text-to-image                | Mature        | 18 models                            | Ideogram 3.0, FLUX.2 Max                  | Strong foundation. Consider adding FLUX.2 Max for grounded generation |
| Image editing (text-guided)  | Mature        | 8 edit models                        | Ideogram 3.0 Reframe                      | Well-covered. GPT Image 1.5 + FLUX Kontext are best-in-class          |
| Image editing (mask/inpaint) | Emerging      | GPT Image 1.5, FLUX Fill             | Ideogram 3.0 inpainting                   | R&D outpaint page exists. Room to expand                              |
| Outpainting                  | Emerging      | GPT Image 1.5                        | Ideogram 3.0 Reframe                      | Active R&D. Needs dedicated UI                                        |
| Text rendering               | Mature        | Recraft V3, GPT Image 1.5            | Ideogram 3.0                              | Best covered by Recraft V3                                            |
| Character consistency        | Emerging      | Nano Banana 2, FLUX.2 Pro            | FLUX.2 Max (10 refs), Midjourney --cref   | Key UX opportunity to surface                                         |
| Multi-reference generation   | Emerging      | FLUX.2 Pro (multi-ref), Seedream 4.5 | FLUX.2 Max (10 refs + web grounding)      | Growing capability, needs UI support                                  |
| Video generation (T2V)       | Missing       | --                                   | Kling 3.0, Sora 2, Veo 3.1 (all on FAL)   | Biggest gap. High priority                                            |
| Video generation (I2V)       | Emerging      | Kling O1 (first-last-frame)          | Kling 3.0, Sora 2, LTX 2.0                | Single model, single workflow                                         |
| Video with audio             | Missing       | --                                   | Kling 3.0, Sora 2, Veo 3.1 (native audio) | Industry standard in Tier 1 models                                    |
| Upscaling                    | Missing       | --                                   | ESRGAN on FAL, FLUX.2 Max native 4MP      | Quick win. ESRGAN available on FAL                                    |
| Face swap                    | Missing       | --                                   | Easel AI on FAL                           | Available but ethically sensitive                                     |
| Style transfer               | Missing       | --                                   | FLUX Schnell Redux on FAL                 | Available via Redux endpoints                                         |
| 3D generation                | Missing       | --                                   | HunyuanVideo 3D v2.1 on FAL               | Early category                                                        |
| Avatar / lip sync            | Missing       | --                                   | HeyGen on FAL                             | New FAL category, emerging demand                                     |
| Vector generation            | Missing       | --                                   | Recraft V3 (SVG output)                   | Recraft already in catalog, needs SVG mode                            |

### Priority Gaps

1. **Video generation (T2V + I2V expansion)** -- Largest capability gap vs. market. All major models available on FAL. Kling 3.0 is the highest-value add (4K, cheapest, best feature set).
2. **Upscaling** -- Table-stakes capability. ESRGAN on FAL is a quick integration.
3. **Character consistency UI** -- Models support it (Nano Banana 2, FLUX.2); needs UI to let users manage character references across generations.
4. **FLUX.2 Max** -- Grounded generation (web search) and 10-reference support is a differentiated capability worth adding.
5. **Outpainting** -- R&D underway. Models available. Needs production UI.

---

## Key Takeaways

1. **FAL is accelerating.** Day-zero model availability, $125M Series C, 1000+ endpoints. GenZen's provider choice is validated and strengthening.

2. **Video is the biggest gap.** GenZen has 1 video model (Kling O1) while FAL now offers 10+ video endpoints including Kling 3.0, Sora 2, and Veo 3.1. All three support native audio generation. This is the highest-priority expansion area.

3. **Character consistency is table-stakes.** Nano Banana 2 (5 characters), FLUX.2 Max (10 references), and Seedream 4.5 (10 references) all support multi-reference generation. GenZen has the models but lacks the UI to leverage this capability.

4. **The model landscape is consolidating around 5 providers:** Black Forest Labs (FLUX), Google (Nano Banana/Veo), OpenAI (GPT Image/Sora), ByteDance (Seedream/Seedance), and Kuaishou (Kling). These are the "safe bets" for long-term model investment.

5. **Midjourney remains API-locked.** No official API means no integration path. Monitor their Enterprise API survey for changes.

6. **Grounded generation is emerging.** FLUX.2 Max and Seedream 5.0 can search the web for real-time context during generation. This is a new capability category that could enable unique workflows.

---

## Sources

- [FAL Blog](https://blog.fal.ai/)
- [FAL Model Explorer](https://fal.ai/explore/models)
- [FAL Video APIs](https://fal.ai/video)
- [Black Forest Labs](https://bfl.ai/)
- [FLUX.2 Max on Replicate](https://replicate.com/black-forest-labs/flux-2-max)
- [Nano Banana 2 Announcement](https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/)
- [Veo 3.1 on Google Developers Blog](https://developers.googleblog.com/introducing-veo-3-1-and-new-creative-capabilities-in-the-gemini-api/)
- [Google DeepMind Veo](https://deepmind.google/models/veo/)
- [Kling 3.0 Review](https://www.readability.com/kling-3-0-and-kling-motion-control-the-future-of-ai-video-creation-in-2026)
- [Seedream 4.5 Guide](https://wavespeed.ai/blog/posts/seedream-4-5-complete-guide-2026/)
- [Seedream 5.0 on ModelsLab](https://modelslab.com/blog/image-generation/seedream-5-0-api-bytedance-image-model-modelslab-2026)
- [Seedance 2.0 on CNBC](https://www.cnbc.com/2026/02/14/new-china-ai-models-alibaba-bytedance-seedance-kuaishou-kling.html)
- [GPT Image 1.5 Announcement](https://openai.com/index/new-chatgpt-images-is-here/)
- [GPT Image 1.5 Review](https://cybernews.com/ai-tools/gpt-image-1-5-review/)
- [Sora 2 + GPT Image 1 on FAL](https://blog.fal.ai/sora-2-gpt-image-1-are-now-available-on-fal/)
- [Recraft V3 on FAL](https://fal.ai/models/fal-ai/recraft/v3/text-to-image)
- [Recraft Documentation](https://www.recraft.ai/docs/recraft-models/recraft-V3)
- [Grok Imagine API](https://x.ai/news/grok-imagine-api)
- [Grok Imagine on FAL](https://fal.ai/models/xai/grok-imagine-image)
- [FLUX Kontext Pro on BFL](https://bfl.ai/models/flux-kontext)
- [Fireworks FLUX Kontext Launch](https://fireworks.ai/blog/flux-kontext-launch)
- [Ideogram 3.0 Features](https://ideogram.ai/features/3.0)
- [Midjourney API Status](https://wedding.alibaba.com/question/does-midjourney-have-an-api-official-statement)
- [Stability AI News](https://stability.ai/news)
- [AI Video Comparison 2026](https://www.teamday.ai/blog/best-ai-video-models-2026)
- [AI Video Pricing 2026](https://devtk.ai/en/blog/ai-video-generation-pricing-2026/)
- [Runway Gen-4 Review](https://max-productive.ai/ai-tools/runwayml/)
- [Nano Banana 2 Subject Consistency](https://www.glbgpt.com/hub/nano-banana-2-subject-consistency/)
- [Character Consistency in AI Art](https://aistorybook.app/blog/ai-image-generation/character-consistency-in-ai-art-solved)
- [Open Source Video Models 2026](https://www.hyperstack.cloud/blog/case-study/best-open-source-video-generation-models)
- [FAL Series C](https://blog.fal.ai/series-c/)
- [AI Image Model Pricing Comparison](https://pricepertoken.com/image)
