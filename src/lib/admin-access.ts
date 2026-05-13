import type { User } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getOptionalAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export function getAdminEmails() {
  return [process.env.ADMIN_EMAILS, process.env.ADMIN_EMAIL]
    .flatMap((value) => (value ?? "").split(","))
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  return Boolean(email && getAdminEmails().includes(email.trim().toLowerCase()));
}

export async function isUserAdmin(user?: User | null) {
  if (!user) {
    return false;
  }

  if (isAdminEmail(user.email)) {
    return true;
  }

  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("role, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  const profile = data as { is_admin?: boolean; role?: string };

  return profile.is_admin === true || profile.role === "admin";
}

export async function getCurrentAdminUser(): Promise<User | null> {
  if (!getSupabaseConfig().configured) {
    return null;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    return (await isUserAdmin(user)) ? user : null;
  } catch {
    return null;
  }
}
