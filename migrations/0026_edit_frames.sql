-- An edit owns one image group for the frames saved out of it (#729). Set on
-- the first press of F, named after the edit. Nulled if the group goes, and
-- the group is left alone when the edit goes: stills are worth keeping
-- whatever happens to the cut.
alter table edits add column group_id uuid references image_groups(id) on delete set null;
