-- A session started as a chat instead of a run (#670). Null on every session
-- made before this and on every run session after it: the column is the kind.
alter table director_sessions add column chat jsonb;
