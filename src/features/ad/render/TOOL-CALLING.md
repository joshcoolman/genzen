# Tool Calling Approach

We switched from json-render to native Anthropic tool calling for simplicity and reliability.

## Why Tool Calling?

**json-render (removed):**

- ❌ Complex setup (catalog, registry, JSONL specs)
- ❌ Claude could hallucinate component names
- ❌ Spec parsing errors
- ❌ Multiple dependencies
- ✅ Good for: Complex multi-component UIs with nesting

**Tool calling (current):**

- ✅ Native to Anthropic SDK
- ✅ Claude can't hallucinate tool names (gets explicit list)
- ✅ Type-safe with JSON schema
- ✅ Simpler code, easier debugging
- ✅ Good for: Specific actions/components like PromptCard

## How It Works

### 1. Define Tool (in useADChat.ts)

```typescript
const PROMPT_CARD_TOOL: Anthropic.Tool = {
  name: 'create_prompt_card',
  description:
    'Display an image generation prompt with copy and save buttons...',
  input_schema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '...' },
      title: { type: 'string', description: '...' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['prompt'],
  },
}
```

### 2. Pass to Claude

```typescript
const stream = client.messages.stream({
  model: 'claude-sonnet-4-6',
  max_tokens: 4096,
  system: systemPrompt,
  tools: [PROMPT_CARD_TOOL],  // ← Claude knows about the tool
  messages: [...]
})
```

### 3. Detect Tool Calls

```typescript
stream.on('content_block_start', (block) => {
  if (block.content_block.type === 'tool_use') {
    toolCalls.push({
      id: block.content_block.id,
      name: block.content_block.name,
      input: block.content_block.input,
    })
  }
})
```

### 4. Render Tool Results

```typescript
// In ChatMessages.tsx
{message.toolCalls && message.toolCalls.map((toolCall) => (
  <PromptCard
    key={toolCall.id}
    {...toolCall.input}
    onCopy={handleCopy}
    onSave={handleSave}
  />
))}
```

## Message Format

```typescript
interface ADMessage {
  id: string
  role: 'user' | 'assistant'
  content: string // Regular text response
  images?: Array<ADImage>
  toolCalls?: Array<{
    id: string
    name: string
    input: PromptCardTool
  }>
}
```

## System Prompt

Simple and direct:

```
## Tool: create_prompt_card

When writing, improving, or analyzing image generation prompts,
use the create_prompt_card tool to display the prompt with
interactive Copy and Save buttons.

Use this tool when:
- Writing a new image generation prompt
- Improving or rewriting an existing prompt
- Analyzing an image and suggesting a prompt to recreate it
- Providing prompt variations
```

No complex JSONL syntax, no spec fences, just: "use this tool when..."

## Adding More Tools

To add a new tool:

1. Define the tool schema in `useADChat.ts`
2. Add to tools array in stream options
3. Handle the tool in `content_block_start` event
4. Render in `ChatMessages.tsx` based on tool name

Example - "save_image" tool:

```typescript
const SAVE_IMAGE_TOOL: Anthropic.Tool = {
  name: 'save_image',
  description: 'Save an AI-generated image to the gallery',
  input_schema: {
    type: 'object',
    properties: {
      imageUrl: { type: 'string' },
      title: { type: 'string' }
    },
    required: ['imageUrl']
  }
}

// In ChatMessages:
{toolCall.name === 'save_image' && (
  <SaveImageCard {...toolCall.input} onSave={handleSaveImage} />
)}
```

## Benefits

1. **Reliability** - Claude sees exact tool definitions, can't make mistakes
2. **Simplicity** - No catalog, registry, or spec parsing
3. **Debugging** - Tool calls are explicit in message stream
4. **Type Safety** - JSON schema validates tool inputs
5. **Performance** - Less overhead, direct rendering

## Testing

```
User: "Write me a prompt for a cyberpunk city"

Claude responds:
  Text: "Here's a detailed prompt for you:"
  Tool call: {
    name: "create_prompt_card",
    input: {
      prompt: "A cyberpunk metropolis at sunset...",
      title: "Cyberpunk City",
      tags: ["atmospheric", "neon", "urban"]
    }
  }

Renders:
  - Conversational text
  - PromptCard with Copy/Save buttons
```

No errors, no spec parsing, just works. ✅
