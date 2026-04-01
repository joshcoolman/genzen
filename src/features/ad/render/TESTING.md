# Testing the PromptCard Feature

## Setup

1. Open AD panel (toggle in status bar)
2. Enter your Anthropic API key
3. Upload or paste an image (optional)

## Test Prompts

### Basic Prompt Generation

```
Write me a detailed prompt for a moody forest scene
```

**Expected:** Conversational response followed by a PromptCard component with:

- Title (e.g., "Moody Forest")
- Detailed prompt text
- Relevant tags (e.g., atmospheric, dark, nature)
- Copy and Save buttons

### Prompt Improvement

```
Improve this prompt: a city at night
```

**Expected:** PromptCard with enhanced version of the original prompt

### Image Analysis (paste an image first)

```
What prompt would recreate this image?
```

**Expected:** PromptCard with a detailed prompt describing the image

### Multiple Variations

```
Give me 3 variations of a sci-fi landscape prompt
```

**Expected:** Multiple PromptCards, each with different creative takes

## Error Handling Tests

### Unknown Component Type

If Claude hallucinates a component name (e.g., `"revenant-prompt"` instead of `"PromptCard"`), you should see:

```
⚠️ Component Error
Unknown component type: "revenant-prompt". Only "PromptCard" is supported.
```

This is a graceful error display instead of a crash.

### Invalid Spec Format

If the spec is malformed, you'll see a similar error message.

## Testing Copy/Save Functions

### Copy Button

1. Click "Copy" on any PromptCard
2. Button should show "Copied" with checkmark for 2 seconds
3. Paste anywhere - should have the full prompt text

### Save Button

1. Must be logged in
2. Click "Save" on any PromptCard
3. Button should show "Saved" with checkmark for 2 seconds
4. Open Prompts library (status bar button)
5. Saved prompt should appear at top of list

## What Claude Should NOT Do

❌ Use component types other than "PromptCard"
❌ Generate specs without conversational text
❌ Put conversational text inside the \`\`\`spec fence
❌ Use incorrect JSONL format

## What Claude SHOULD Do

✅ Provide conversational text first
✅ Use PromptCard for image generation prompts
✅ Use proper JSONL format (one JSON object per line)
✅ Include title and tags in PromptCard props
✅ Keep prompts between 10-2000 characters

## System Prompt Guidance

The system prompt now includes:

- Clear instruction that ONLY "PromptCard" is valid
- Exact syntax examples
- When to use PromptCard
- Critical formatting rules

If Claude still hallucinates component names, the error handling will catch it and show a helpful message instead of crashing.
