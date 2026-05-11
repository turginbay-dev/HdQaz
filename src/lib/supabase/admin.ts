import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    url,
    serviceRoleKey,
    configured: Boolean(url && serviceRoleKey)
  };
}

export function createAdminClient() {
  const config = getSupabaseAdminConfig();

  if (!config.url || !config.serviceRoleKey) {
    throw new Error("Supabase admin is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  cachedClient ??= createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return cachedClient;
}

export function getOptionalAdminClient() {
  return getSupabaseAdminConfig().configured ? createAdminClient() : null;
}
