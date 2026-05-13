import type { User } from "@supabase/supabase-js";
import { isUserAdmin } from "@/lib/admin-access";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile, getUserPremiumStatus } from "@/features/users/repository";
import type { UserProfile, UserSubscriptionStatus } from "@/types/backend";

export type ViewerContext = {
  isAdmin: boolean;
  premium: UserSubscriptionStatus;
  profile: UserProfile | null;
  user: User | null;
};

export async function getViewerContext(): Promise<ViewerContext> {
  if (!getSupabaseConfig().configured) {
    return {
      isAdmin: false,
      premium: {
        isPremium: false,
        plan: "free",
        status: "inactive"
      },
      profile: null,
      user: null
    };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        isAdmin: false,
        premium: {
          isPremium: false,
          plan: "free",
          status: "inactive"
        },
        profile: null,
        user: null
      };
    }

    const [profile, isAdmin, premium] = await Promise.all([
      getOrCreateProfile(user),
      isUserAdmin(user),
      getUserPremiumStatus(user.id)
    ]);

    return {
      isAdmin,
      premium,
      profile,
      user
    };
  } catch {
    return {
      isAdmin: false,
      premium: {
        isPremium: false,
        plan: "free",
        status: "inactive"
      },
      profile: null,
      user: null
    };
  }
}
