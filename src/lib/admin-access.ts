import type { User } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
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

export async function getCurrentAdminUser(): Promise<User | null> {
  if (!getSupabaseConfig().configured) {
    return null;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    return isAdminEmail(user?.email) ? user : null;
  } catch {
    return null;
  }
}
