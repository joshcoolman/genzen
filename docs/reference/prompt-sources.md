# Prompt Sources Research

Research on discovering and curating high-quality AI image generation prompts for GenZen.

**Date:** 2026-04-01  
**Status:** Initial Research  
**Context:** Exploring sources for trending/quality prompts to enhance the prompt library feature

---

## Overview

Users want access to proven, high-quality prompts for image generation. This research explores available sources, their accessibility, and recommended approaches for integration.

### Key Findings

- **Manual curation > automated scraping** for initial library
- **Reddit JSON feeds** are free, fast, and viable for weekly trending updates
- **Firecrawl agent extraction** is too slow (~2min+) and expensive for daily use
- **Multiple specialized communities** exist with different strengths

---

## Priority Prompt Sources

### 1. PromptHero

**URL:** https://prompthero.com/flux-prompts

**Strengths:**

- Massive database (109k+ FLUX prompts)
- Real examples with generated images
- Filter by model, style, trending, hot, top
- Shows generation parameters (steps, CFG, etc.)
- Clean prompt display with like counts

**Use Case:**

- Manual browse → curate top 20-30 per category
- Research popular styles and keywords
- See what actually works in practice

**Data Available:**

- Prompt text
- Model used (FLUX Pro, FLUX Dev, etc.)
- Like/favorite counts
- Generated image URL
- Generation parameters

**Access:**

- Web-only (React SPA)
- No official API
- Scraping possible but expensive/slow

---

### 2. Lexica.art

**URL:** https://lexica.art/

**Strengths:**

- Visual search - find similar images
- Stable Diffusion focused but patterns apply across models
- Clean UI, easy to browse
- Shows related prompts

**Use Case:**

- Discover style keywords
- Visual exploration ("show me images like this")
- Cross-reference prompt patterns

**Notes:**

- Originally SD-focused but expanding
- Great for understanding prompt engineering patterns
- Good for research, not necessarily trending

---

### 3. Civitai

**URL:** https://civitai.com/

**Strengths:**

- Huge active community
- Model-specific examples (FLUX, SD, etc.)
- User ratings and comments
- Download counts show popularity
- Example images for each model

**Weaknesses:**

- Contains NSFW content (requires filtering)
- More technical/hobbyist audience

**Use Case:**

- Deep-dive into specific models
- See community feedback on prompts
- Find model-specific techniques

---

### 4. FLUX Prompt Explorer ⭐

**URL:** https://fluxproweb.com/flux-prompt-explore/

**Strengths:**

- Purpose-built for FLUX prompt discovery
- Free to use
- Focused specifically on our use case

**To Explore:**

- Data structure and availability
- Coverage and quality
- Update frequency

---

### 5. Black Forest Labs Official Docs

**URL:** https://docs.bfl.ml/guides/prompting_guide_flux2

**Strengths:**

- Official guidance from FLUX creators
- Best practices for FLUX 2 Pro/Max
- Technical insights into what works

**Use Case:**

- Educational content for docs
- Reference for writing prompt guidelines
- Understanding model-specific behavior

---

### 6. Reddit Communities (Free API Access!)

#### r/StableDiffusion

- 622 FLUX Style Examples: https://www.reddit.com/r/StableDiffusion/comments/1evchiu/flux_style_test_gallery_622_examples_of_style/
- Very active, technical discussions
- "Prompt in comments" culture

#### r/FluxAI

- FLUX-specific community
- Latest techniques and discoveries
- Model comparisons

#### r/midjourney

- Different model but overlapping techniques
- High-quality aesthetic focus

**API Access (No Key Required!):**

```bash
# Get top posts from last week
curl 'https://www.reddit.com/r/StableDiffusion/top.json?limit=25&t=week'
curl 'https://www.reddit.com/r/FluxAI/hot.json?limit=25'

# Response includes:
# - Post title (often contains prompt)
# - Post body (detailed prompts)
# - Comments (users share prompts)
# - Upvotes (quality signal)
# - Image URLs
```

**Viability for Automation:**
✅ Free, no API key  
✅ Fast (<1 second)  
✅ Structured JSON  
✅ Can filter by upvotes/time  
✅ Could run daily without cost concerns

---

### 7. Fiddl.art Prompt Guide

**URL:** https://fiddl.art/blog/en/ai-image-prompts

**Strengths:**

- 50+ curated examples
- Categorized by use case
- Copy-paste ready
- Educational explanations

**Use Case:**

- Quick wins for seeding initial library
- Template reference
- User education

---

### 8. AIML API Blog

**URL:** https://aimlapi.com/blog/top-10-prompts-for-flux-1-1-pro-best-image-generation-ideas

**Strengths:**

- Curated "top 10" lists
- Explanations of why prompts work
- Technical insights

**Use Case:**

- Quick reference
- Understanding effective patterns

---

## GenZen-Specific Considerations

### Target Prompt Categories

Given GenZen's focus on video/cinematic generation:

**1. Cinematic/Film (Priority)**

- Camera angles: low angle, dutch tilt, overhead shot, POV
- Lenses: anamorphic, 35mm, 50mm, telephoto, wide angle
- Film stock: kodak vision3, fujifilm, 16mm grain
- Lighting: golden hour, rim light, volumetric fog, chiaroscuro
- References: "blade runner aesthetic", "wes anderson palette", "Roger Deakins cinematography"

**2. Portrait/Character**

- Consistent character generation
- Expression and emotion
- Clothing and styling
- Background context

**3. Landscape/Environment**

- Location establishment shots
- Atmospheric elements
- Time of day variations
- Weather effects

**4. Product/Commercial**

- Clean product shots
- Commercial lighting
- Minimalist backgrounds

**5. Experimental/Artistic**

- Style mixing
- Abstract concepts
- Unique aesthetics

### Keywords to Research

**Camera/Technical:**

- Bokeh, depth of field, focus pull
- Film grain, chromatic aberration
- Lens flare, lens distortion
- Handheld, steadicam, dolly shot

**Lighting:**

- Three-point lighting, practical lights
- Motivated lighting, ambient occlusion
- Color temperature, gel filters
- Hard light vs soft light

**Composition:**

- Rule of thirds, leading lines
- Negative space, symmetry
- Framing, aspect ratio

**Style References:**

- Director names (Villeneuve, Anderson, Nolan)
- Cinematographer names (Deakins, Chivo, Hoyte van Hoytema)
- Film titles ("blade runner 2049", "her", "the grand budapest hotel")
- Art movements (film noir, neo-realism, surrealism)

---

## Implementation Strategies

### Phase 1: Manual Curation (Immediate)

**Time Investment:** 2-3 hours  
**Output:** 30-50 high-quality seed prompts

**Process:**

1. Browse PromptHero FLUX prompts (filter: cinematic, photography)
2. Check FLUX Prompt Explorer
3. Review Reddit FLUX Style Gallery (622 examples)
4. Extract 10 prompts per category:
   - Cinematic/film
   - Portrait/character
   - Landscape/environment
   - Product/commercial
   - Experimental/artistic

**Data Structure:**

```typescript
interface CuratedPrompt {
  id: string
  text: string
  category: string[] // ['cinematic', 'portrait']
  tags: string[] // ['golden-hour', '35mm', 'bokeh']
  model: string // 'flux-pro', 'flux-dev'
  source: {
    platform: string // 'prompthero', 'reddit'
    url?: string
    author?: string
  }
  metrics?: {
    likes?: number
    tested?: boolean // Did we verify it works well?
  }
  notes?: string // Optional context/tips
}
```

### Phase 2: Reddit Integration (Later)

**Automation Potential:** Daily/weekly cron job  
**Cost:** $0  
**Latency:** <1 second

**Approach:**

1. Fetch top posts from relevant subreddits
2. Parse titles/bodies for prompts
3. Filter by upvote threshold (e.g., 100+)
4. Extract image URLs and metadata
5. Store as "trending this week" feed

**Example Implementation:**

```typescript
// server/tasks/fetch-trending-prompts.ts
async function fetchTrendingFromReddit() {
  const subs = ['StableDiffusion', 'FluxAI', 'midjourney']
  const prompts = []

  for (const sub of subs) {
    const res = await fetch(
      `https://www.reddit.com/r/${sub}/top.json?limit=25&t=week`,
    )
    const data = await res.json()

    // Parse posts, extract prompts from title/body
    // Filter by upvotes, check for image URLs
    // Add to prompts array
  }

  return prompts
}
```

### Phase 3: User-Generated (Future)

- Let users save favorite prompts
- Community voting/starring
- User submissions with moderation
- Build proprietary prompt library

---

## Rejected Approaches

### ❌ Firecrawl Agent for Daily Scraping

**Why Not:**

- Too slow (2+ minutes per extraction)
- Too expensive (credits add up)
- Unnecessary complexity
- Unreliable (structure changes break scraper)

**When to Use:**

- One-time bulk research (e.g., scrape Reddit 622 gallery)
- Initial exploration of new sources
- Analyzing trends across multiple sites

### ❌ Real-time Web Scraping

**Why Not:**

- Latency issues (5-30 seconds)
- Cost per request
- Terms of Service violations
- Maintenance burden

---

## Recommended Next Steps

1. **Create Seed Prompts** (Manual)
   - Spend 2 hours curating 30-50 prompts
   - Focus on cinematic/video use cases
   - Tag thoroughly
   - Test each prompt to verify quality

2. **Document in Codebase**
   - Create `src/features/prompts/data/seed-prompts.ts`
   - Structure with TypeScript types
   - Include metadata and sources

3. **Build UI for Discovery**
   - Filter by category/tag
   - Search functionality
   - Visual preview grid
   - "Copy prompt" button

4. **Add External Links**
   - "Browse more on PromptHero →"
   - "Explore Lexica.art →"
   - Don't try to replicate everything, link out

5. **Consider Reddit Integration** (Optional)
   - Weekly trending prompts digest
   - Low effort, high value
   - Free API access

6. **User Features** (Later)
   - Save favorite prompts
   - User submissions
   - Community curation

---

## Additional Resources

### Educational Content

- FLUX official docs: https://docs.bfl.ml/
- Prompt engineering guides
- Cinematic photography reference

### GitHub Repositories

- Search "awesome prompt lists" on GitHub
- Community-curated collections
- Public datasets on HuggingFace

### Visual Reference

- Shot List database: https://shotdeck.com/
- Cinematography database
- Film frame galleries

---

## Notes

- Focus on **quality over quantity** - 30 great prompts > 1000 mediocre ones
- **Attribution matters** - credit sources when known
- **Test before publishing** - verify prompts actually work with your FAL integration
- **Tag thoroughly** - good taxonomy makes prompts discoverable
- **Start simple** - manual curation first, automation later only if needed
- **Link out liberally** - don't try to own all prompt discovery, guide users to great sources

---

## See Also

- [Image Prompting Reference](../reference/image-prompting.md) - Technical guide to prompt structure
- [Video Prompts Reference](../reference/video-prompts.md) - Video-specific prompting
- [Prompt Studio Feature](../features/prompt-studio.md) - Multi-LLM prompt testing
- [Prompts Feature](../features/prompts.md) - Personal prompt library
- [FAL AI Integration](../features/ai-images.md) - Image generation implementation
