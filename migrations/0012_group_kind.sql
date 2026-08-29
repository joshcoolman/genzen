-- #517: groups hold clips too, in their own namespace.
--
-- A clip has always been a `user_images` row -- `source = 'ai_video'` -- so it
-- already carried `group_id` from #319 and the ten write functions in
-- `groups.action.ts` never filtered on `source`. Filing a clip into a group
-- would have worked the day this column arrived. What was missing is the
-- separation.
--
-- **Separate namespaces, not one shared pool.** A mixed group reads better as
-- an idea and breaks #319's load-bearing rule in practice: membership is
-- exclusive so the top-level grid can *replace* a group's members with its
-- card. A group holding both would appear on /images and /video at once, each
-- drawing only the half it can render, and filing a clip into an image group
-- would take it off /video's top level with nothing on screen saying where it
-- went. "Where is this thing" would stop having an answer -- the same question
-- exclusive membership exists to keep answerable.
--
-- Default 'image' so every group that already exists keeps the meaning it had.
-- No backfill: there were no video groups to find.
--
-- Not enforced between a group and its members. `addImagesToGroup` checks that
-- the rows it is filing match the group's kind, in application code, so a
-- forged request files nothing instead of erroring -- and the check has the
-- `user_id` scope already in hand there. A constraint here would need a
-- trigger to see across the two tables, which is a lot of machinery for a rule
-- one function enforces.
alter table image_groups
  add column kind text not null default 'image'
  check (kind in ('image', 'video'));

comment on column image_groups.kind is
  'Which surface this group belongs to -- ''image'' for /images, ''video'' for /video. Namespaces are disjoint: a clip cannot join an image group (#517).';

-- Every read is "this user's groups, of this kind", which is this index.
-- Replaces the user-only one: it answers the same question, plus the kind.
drop index if exists image_groups_user_id_idx;
create index image_groups_user_kind_idx on image_groups (user_id, kind);
