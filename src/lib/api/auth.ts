import type { User } from "@supabase/supabase-js";
import { isAdminEmail } from "@/lib/admin-access";
import { ApiError } from "@/lib/api/errors";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type AuthContext = {
  user: User | null;
  isAdmin: boolean;
  adminSource?: "email" | "token";
};

function getRequestToken(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const headerToken = request.headers.get("x-admin-token")?.trim();

  return bearer || headerToken;
}

function hasValidAdminToken(request: Request) {
  const expectedToken = process.env.BACKEND_ADMIN_TOKEN?.trim();

  return Boolean(expectedToken && getRequestToken(request) === expectedToken);
}

export async function getAuthContext(request: Request): Promise<AuthContext> {
  const config = getSupabaseConfig();
  let user: User | null = null;

  if (config.configured) {
    try {
      const supabase = await createClient();
      const result = await supabase.auth.getUser();
      user = result.data.user;
    } catch {
      user = null;
    }
  }

  const email = user?.email?.toLowerCase();
  const isAllowedAdminEmail = isAdminEmail(email);
  const isAdminToken = hasValidAdminToken(request);

  return {
    user,
    isAdmin: isAllowedAdminEmail || isAdminToken,
    adminSource: isAllowedAdminEmail ? "email" : isAdminToken ? "token" : undefined
  };
}

export async function requireUser(request: Request) {
  const context = await getAuthContext(request);

  if (!context.user) {
    throw new ApiError(401, "unauthorized", "Authentication is required.");
  }

  return {
    ...context,
    user: context.user
  };
}

export async function requireAdmin(request: Request) {
  const context = await getAuthContext(request);

  if (!context.isAdmin) {
    throw new ApiError(403, "forbidden", "Admin access is required.");
  }

  return context;
}
