"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getSiteUrl } from "@/lib/site-url";

function getEmailPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  return {
    email,
    password
  };
}

async function getAuthCallbackUrl() {
  const headersList = await headers();
  const forwardedHost = headersList.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headersList.get("host");

  if (host) {
    const forwardedProto = headersList.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const isLocalHost = host.startsWith("localhost") || host.startsWith("127.0.0.1");
    const protocol = forwardedProto || (isLocalHost ? "http" : "https");

    return `${protocol}://${host}/auth/callback`;
  }

  return `${getSiteUrl()}/auth/callback`;
}

export async function signInWithGoogle() {
  const config = getSupabaseConfig();

  if (!config.configured) {
    redirect("/login?error=supabase_not_configured");
  }

  const supabase = await createClient();
  const authCallbackUrl = await getAuthCallbackUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: authCallbackUrl,
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

export async function signInWithPassword(formData: FormData) {
  const config = getSupabaseConfig();

  if (!config.configured) {
    redirect("/login?error=supabase_not_configured");
  }

  const { email, password } = getEmailPassword(formData);

  if (!email || password.length < 6) {
    redirect("/login?error=email_password_required");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    redirect("/login?error=email_signin_failed");
  }

  redirect("/profile");
}

export async function signOut() {
  const config = getSupabaseConfig();

  if (config.configured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/");
}
