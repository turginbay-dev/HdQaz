import Image from "next/image";
import { redirect } from "next/navigation";
import { Crown, LogOut, Mail, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Профиль"
};

export default async function ProfilePage() {
  const config = getSupabaseConfig();

  if (!config.configured) {
    redirect("/login?error=supabase_not_configured");
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "HdQaz қолданушысы";
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  return (
    <main className="ambient-page min-h-screen px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <section className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="glass-strong rounded-[34px] p-6">
          <div className="relative h-24 w-24 overflow-hidden rounded-3xl border border-white/10 bg-white/10">
            {avatarUrl ? (
              <Image src={avatarUrl} alt={name} fill sizes="96px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-white">
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">{name}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
            <Mail className="h-4 w-4" />
            {user.email}
          </p>

          <form action={signOut} className="mt-6">
            <button
              className="glass-button inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white"
              type="submit"
            >
              <LogOut className="h-4 w-4" />
              Шығу
            </button>
          </form>
        </aside>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="glass rounded-[30px] p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[var(--accent)]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-white">Google аккаунт қосылған</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Кіру әдісі: Google OAuth. Telegram арқылы кіру бұл жобада қолданылмайды.
            </p>
          </div>

          <div className="glass rounded-[30px] p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(217,183,111,0.16)] text-[var(--accent)]">
              <Crown className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-semibold text-white">Premium статус</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Келесі кезеңде subscription кестесімен байланыстырамыз.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
