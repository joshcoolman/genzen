-- Drop dead tables left over from the "Phase 5" consolidation and abandoned
-- features. None of these have any live code path (verified by a full feature
-- audit): videos/shots now live in user_images.generation_metadata; the
-- storyboard / style-collection / user-preferences features were never wired up.
--
-- Surviving live tables: user_images, user_profiles, credit_transactions,
-- api_keys, fal_price_cache, notes, user_prompts, prompt_studio_sets.

DROP TABLE IF EXISTS public.video_workspaces CASCADE;
DROP TABLE IF EXISTS public.video_generations CASCADE;
DROP TABLE IF EXISTS public.multishot_sequences CASCADE;
DROP TABLE IF EXISTS public.storyboards CASCADE;
DROP TABLE IF EXISTS public.style_collections CASCADE;
DROP TABLE IF EXISTS public.style_images CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;

-- Removed features: the Notes page and the bottom Prompts library panel were
-- deleted entirely. AD no longer saves chats to notes or prompt cards to a
-- library (copy-only). Surviving live tables now: user_images, user_profiles,
-- credit_transactions, api_keys, fal_price_cache, prompt_studio_sets.
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.user_prompts CASCADE;

-- Prompt Studio feature removed (was a self-contained experiment). Surviving
-- live tables now: user_images, user_profiles, credit_transactions, api_keys,
-- fal_price_cache.
DROP TABLE IF EXISTS public.prompt_studio_sets CASCADE;
