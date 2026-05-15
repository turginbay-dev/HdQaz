import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { EmailPasswordAuthForm } from "@/components/auth/email-password-auth-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LogoMark } from "@/components/layout/site-logo";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    message?: string;
  }>;
};

const errorMessages: Record<string, string> = {
  supabase_not_configured:
    "Supabase env әлі қосылмаған. .env.local ішіне Supabase URL және anon key енгізіңіз.",
  email_password_required: "Email енгізіп, кемінде 6 таңбалы пароль жазыңыз.",
  email_signin_failed: "Email немесе пароль дұрыс емес.",
  email_signup_failed: "Email арқылы тіркелу орындалмады. Supabase Email provider баптауын тексеріңіз.",
  google_oauth_failed: "Google арқылы кіру басталмады. Supabase Google provider баптауын тексеріңіз.",
  auth_callback_failed: "Google callback аяқталмады. Redirect URL баптауын тексеріңіз.",
  captcha_failed: "Қауіпсіздік тексерісі өтпеді. CAPTCHA-ны қайта орындап көріңіз.",
  captcha_not_configured: "Cloudflare Turnstile толық бапталмаған. Site key және secret key мәндерін тексеріңіз."
};

const statusMessages: Record<string, string> = {
  check_email: "Аккаунтты растау үшін email поштаңызды тексеріңіз."
};

export const metadata = {
  title: "Кіру"
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const config = getSupabaseConfig();
  const params = await searchParams;

  if (config.configured) {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/profile");
    }
  }

  const error = params?.error ? errorMessages[params.error] : null;
  const status = params?.message ? statusMessages[params.message] : null;

  return (
    <main className="ambient-page relative min-h-screen overflow-hidden px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_12%,rgba(217,183,111,0.18),transparent_34%),radial-gradient(ellipse_at_12%_20%,rgba(143,183,255,0.13),transparent_28%)]" />
      <div className="cinematic-fog" />

      <section className="relative mx-auto grid min-h-[calc(100vh-7rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_460px]">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-zinc-200 backdrop-blur-2xl">
            <LogoMark className="h-7 w-11 p-0.5" sizes="44px" />
            HdQaz Account
          </div>
          <h1 className="max-w-3xl font-bold leading-[0.94] tracking-[-0.032em] text-white [font-size:clamp(3.2rem,7.4vw,7rem)]">
            Бір аккаунт. Барлық қазақша кино.
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium leading-7 tracking-[0.004em] text-zinc-300 sm:text-lg sm:leading-8">
            Email және парольмен немесе Google арқылы кіріп, көру тарихын, Premium статусын және жеке ұсыныстарды сақтаңыз.
          </p>
        </div>

        <div className="glass-strong rounded-[34px] p-5 sm:p-7">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(217,183,111,0.16)] text-[var(--accent)]">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-[-0.018em] text-white">Кіру</h2>
          <p className="mt-3 text-sm font-medium leading-6 tracking-[0.004em] text-zinc-400">
            Бұл жобада тек email/password және Google арқылы кіру қолданылады.
          </p>

          {error && (
            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
              {error}
            </div>
          )}

          {status && (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm leading-6 text-emerald-100">
              {status}
            </div>
          )}

          {!config.configured && (
            <div className="mt-5 rounded-2xl border border-[rgba(217,183,111,0.26)] bg-[rgba(217,183,111,0.1)] p-4 text-sm leading-6 text-zinc-200">
              Auth іске қосу үшін `.env.local` ішіне `NEXT_PUBLIC_SUPABASE_URL`
              және `NEXT_PUBLIC_SUPABASE_ANON_KEY` мәндерін енгізу керек.
            </div>
          )}

          <div className="mt-6">
            <EmailPasswordAuthForm disabled={!config.configured} />
          </div>

          <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            <span className="h-px flex-1 bg-white/10" />
            немесе
            <span className="h-px flex-1 bg-white/10" />
          </div>

          <div>
            <GoogleSignInButton disabled={!config.configured} />
          </div>
        </div>
      </section>
    </main>
  );
}
