-- #582: stop storing a shortened copy of the prompt.
--
-- `description` has carried `char_length(description) <= 1000` since 0001, and
-- `fal-completion.server.ts` wrote around it by cutting the prompt at 997
-- characters and appending an ellipsis. Nobody noticed until the viewer put a
-- prompt on screen in full (#580) and it ended mid-word: "The camera sits low
-- and close enoug...".
--
-- The 1000 was never a real limit. It was a plausible cap on a *user-written*
-- caption, which is what this column held when it was written; a generation's
-- prompt moved in later, and the Shots and Lighting features write prompts of
-- three or four thousand characters as a matter of course. Truncation is a
-- display concern -- the card clamps its caption to three lines and always
-- has -- and doing it at write time destroys the thing being described.
--
-- Nothing replaces the check. A prompt has no natural length, and inventing a
-- larger number just moves the same failure further out.
alter table user_images
  drop constraint user_images_description_check;

comment on column user_images.description is
  'A user-written caption, a Describe result, or -- on a generation -- the full prompt. Unbounded on purpose (#582): the 1000-character cap silently cut long prompts mid-word. Clamp for display, never on write.';

-- ---------------------------------------------------------------------------
-- put back what was cut
-- ---------------------------------------------------------------------------

-- Recoverable because the truncation only ever hit the *copy*.
-- `generation_metadata -> 'prompt'` is jsonb, written at submit time by
-- `create-pending-generation.server.ts`, and was never bounded -- so the whole
-- prompt has been sitting alongside the shortened one the entire time. No row
-- lost anything; the surfaces were reading the wrong one of two copies.
--
-- The predicate is exact rather than "ends with an ellipsis": a caption
-- someone wrote could legitimately trail off, and the metadata prompt must
-- agree with the stored prefix character for character before this overwrites
-- anything. A row that fails any part of it is left alone.
update user_images
set description = generation_metadata ->> 'prompt'
where char_length(description) = 1000
  and description like '%...'
  and generation_metadata ->> 'prompt' is not null
  and left(generation_metadata ->> 'prompt', 997) = left(description, 997);
