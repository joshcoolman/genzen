import { createClient } from "@supabase/supabase-js";

export async function requireAuth(accessToken: string) {
  if (!accessToken) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return user;
}
