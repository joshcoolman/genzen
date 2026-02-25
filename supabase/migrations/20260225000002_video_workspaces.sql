-- Video workspaces and generations for persistent FLF history

CREATE TABLE public.video_workspaces (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.video_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own workspaces"
  ON public.video_workspaces
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.video_generations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.video_workspaces(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_frame_id  uuid REFERENCES public.user_images(id) ON DELETE SET NULL,
  last_frame_id   uuid REFERENCES public.user_images(id) ON DELETE SET NULL,
  video_id        uuid REFERENCES public.user_images(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own generations"
  ON public.video_generations
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX video_workspaces_user_id_idx ON public.video_workspaces (user_id);
CREATE INDEX video_generations_workspace_id_idx ON public.video_generations (workspace_id);
CREATE INDEX video_generations_user_id_idx ON public.video_generations (user_id);
