-- Director was isolated in #679: a clip born in a session carries
-- origin = 'director' and is hidden from the Video wall. Clips made in
-- sessions before that were stamped 'images', so they still showed there.
-- Every clip a session references was born in it (Add clips was never used
-- before it was removed), so session membership is the stamp. Re-rolls that
-- dropped out of a run before #679 are referenced by nothing and stay put.
update user_images
set origin = 'director'
where source = 'ai_video'
  and origin <> 'director'
  and id in (
    select (jsonb_array_elements_text(cut->'clipIds'))::uuid
    from director_sessions
  );
