-- Multi-shot video sequences
CREATE TABLE public.multishot_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Untitled',
  shots jsonb NOT NULL DEFAULT '[]',
  elements jsonb NOT NULL DEFAULT '[]',
  settings jsonb NOT NULL DEFAULT '{}',
  video_record_id uuid REFERENCES public.user_images(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  estimated_cost numeric(6,3),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.multishot_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sequences"
  ON public.multishot_sequences FOR ALL USING (auth.uid() = user_id);
