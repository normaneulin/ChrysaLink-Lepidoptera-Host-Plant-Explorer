import { createClient } from "https://esm.sh/@supabase/supabase-js";

// Initialize Supabase client with service role key (backend only)
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing Supabase environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Ensure a profile row exists for a given user ID.
 * Upserts a basic profile record from auth user data.
 */
export async function ensureProfileForUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
}) {
  if (!user?.id) {
    return;
  }

  try {
    const { data, error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        email: user.email || null,
        name: user.user_metadata?.name || null,
      },
      { returning: "minimal" }
    );

    if (error) {
      console.warn("Failed to upsert profile:", error.message);
    }
  } catch (err) {
    console.error("ensureProfileForUser error:", err);
  }
}
