"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getSiteUrl } from "@/lib/site-url";

export async function signInWithGoogle() {
  const config = getSupabaseConfig();

  if (!config.configured) {
    redirect("/login?error=supabase_not_configured");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account"
      }
    }
  });

  if (error || !data.url) {
    redirect("/login?error=google_oauth_failed");
  }

  redirect(data.url);
}

export async function signOut() {
  const config = getSupabaseConfig();

  if (config.configured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/");
}
