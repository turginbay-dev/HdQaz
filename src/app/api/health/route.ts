import { ok } from "@/lib/api/responses";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getSupabaseAdminConfig } from "@/lib/supabase/admin";

export async function GET() {
  const publicSupabase = getSupabaseConfig();
  const adminSupabase = getSupabaseAdminConfig();

  return ok({
    status: "ok",
    services: {
      supabasePublic: publicSupabase.configured,
      supabaseAdmin: adminSupabase.configured,
      tmdb: Boolean(process.env.TMDB_ACCESS_TOKEN),
      adminEmails: Boolean(process.env.ADMIN_EMAILS?.trim()),
      adminToken: Boolean(process.env.BACKEND_ADMIN_TOKEN?.trim())
    }
  });
}
