# Multi-Shot

Residual types and UI component from the original multi-shot video feature. The user-facing flow has been merged into the unified `ai-video` feature with parent/child grouping; only the FAL model constant, shared types, and ShotCard component remain here for reuse.

## Key Files

- `types.ts` -- `Shot`, `MultiShotElement`, `MultiShotSettings`, `MultiShotSequence`, `GenerationRecord` types; constants `MAX_SHOTS=6`, `MAX_TOTAL_DURATION=15`, `MIN_SHOT_DURATION=3`, `PRICE_PER_SEC_AUDIO`; `DEFAULT_SETTINGS`; `MULTISHOT_FAL_MODEL` (`fal-ai/kling-video/v3/pro/image-to-video`)
- `index.ts` -- barrel exports: `MULTISHOT_FAL_MODEL`, `Shot`, `MultiShotElement`, `ShotCard`
- `components/ShotCard.tsx` -- single shot card with prompt textarea and duration stepper (min 3s); used by `ai-video` VideoGeneratorPanel in multishot mode
- `persona.md` -- creative director guidance for multi-shot prompting, camera language, pacing, composition

## Route

No dedicated route -- multishot generation is now a mode toggle inside the `ai-video` VideoGeneratorPanel.

## Shared Dependencies

- `src/features/ai-video/` -- consumes `ShotCard` and types for multishot mode in VideoGeneratorPanel

## Quirks / Notes

- The original standalone multi-shot architecture (sequences table, list/detail pages, editor, hooks, server functions) was deleted in Phase 5 and merged into ai-video
- Elements are referenced in shot prompts as @Element1, @Element2, etc.
- Total duration budget: 15 seconds across all shots, minimum 3s per shot
- Dual pricing: 0.168 credits/s with audio, 0.14 credits/s without
