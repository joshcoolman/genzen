# AD json-render Integration

Interactive generative UI components for the AD chat assistant.

## Quick Start

The AD assistant can now render interactive components when providing prompts or creative direction. No code changes needed to use it—Claude automatically knows when to render components based on the catalog.

## Available Components

### PromptCard

Displays a generated prompt with Copy and Save buttons. Saved prompts go directly to the user's prompt library.

**Props:**

- `prompt` (string, required) - The image generation prompt text
- `title` (string, optional) - Title for the prompt
- `tags` (string[], optional) - Category/style tags

**Example spec (what Claude generates):**

```spec
{"op":"add","path":"/root","value":"prompt-1"}
{"op":"add","path":"/elements/prompt-1","value":{"type":"PromptCard","props":{"prompt":"A cyberpunk city at sunset with neon lights reflecting on wet streets, shot on 35mm film, cinematic composition","title":"Cyberpunk City","tags":["atmospheric","neon","urban","cinematic"]},"children":[]}}
```

## Testing

1. Open AD panel (toggle in status bar)
2. Enter your Anthropic API key
3. Try these prompts:
   - "Write me a detailed prompt for a moody forest scene"
   - "Improve this prompt: a city at night"
   - _Paste an image_ + "What prompt would recreate this image?"
   - "Give me 3 prompt variations for a sci-fi landscape"

Claude will automatically render PromptCard components when appropriate, with Copy and Save buttons.

## How It Works

1. **Catalog** (`catalog.ts`) - Defines available components, props schemas (Zod), and action signatures
2. **Components** (`components.tsx`) - React implementations with handlers for copy/save actions
3. **System Prompt** (`context/ad-context.tsx`) - Includes catalog documentation so Claude knows when/how to use components
4. **Streaming** (`hooks/useADChat.ts`) - Parses `\`\`\`spec` fences, streams specs progressively
5. **Rendering** (`components/ChatMessages.tsx`) - Wraps Renderer in JSONUIProvider (required for visibility/state contexts), renders specs alongside markdown text

## Adding New Components

1. **Define in catalog:**

   ```typescript
   MyComponent: {
     props: z.object({
       title: z.string(),
       items: z.array(z.string())
     }),
     description: 'What it does and when to use it',
     example: { title: 'Example', items: ['one', 'two'] }
   }
   ```

2. **Implement React component:**

   ```typescript
   MyComponent: ({ props, emit }) => (
     <div>
       <h3>{props.title}</h3>
       {props.items.map(item => <div key={item}>{item}</div>)}
     </div>
   )
   ```

3. **Add actions if needed:**

   ```typescript
   actions: {
     myAction: {
       description: 'What this action does'
     }
   }
   ```

4. **Update system prompt guidelines** in `ad-context.tsx` if component has specific usage patterns

## Integration Points

- **Prompts feature** - PromptCard's Save button calls `savePrompt` server action
- **Auth** - Save actions require valid session (automatically gated)
- **Clipboard** - Copy actions use `navigator.clipboard` API

## Future Components

Ideas for expansion:

- `ImageAnalysis` - Show structured image descriptions with tags/metadata
- `PromptComparison` - Side-by-side before/after prompt comparison
- `VariationGrid` - Grid of prompt variations with individual copy buttons
- `ModelRecommendation` - Suggest best model for a given prompt
- `AspectRatioSuggestion` - Recommend aspect ratios with reasoning
