import Link from "next/link";
import { Check, Crown, Sparkles } from "lucide-react";
import { GlassPanel } from "@/components/glass/glass-panel";
import { LogoMark } from "@/components/layout/site-logo";
import { getViewerContext } from "@/features/users/session";
import { formatKazakhDateTime } from "@/lib/formatters";

export const metadata = {
  title: "Premium"
};

const benefits = [
  "жарнамасыз көру",
  "ерте қолжетімділік",
  "таңдаулы сапа",
  "жеке тізім",
  "premium badge"
];

export default async function PremiumPage() {
  const viewer = await getViewerContext();

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <div className="mx-auto mb-10 max-w-3xl text-center">
        <LogoMark className="mx-auto mb-4 h-20 w-32 p-2" sizes="128px" />
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
          HdQaz Premium
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.026em] text-white sm:text-6xl">
          Premium қосу
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-7 text-zinc-300">
          Төлем жүйесі дайындықта. Жазылым кестесі қосылды, сондықтан Premium статусын әкімші SQL арқылы қоса алады.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassPanel className="p-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Free plan</p>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.018em] text-white">Free</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-zinc-400">
            Ашық каталог, профиль, пікірлер, ұнату және жеке тізім.
          </p>
          <Link
            href="/catalog"
            className="glass-button mt-6 inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-bold text-white"
          >
            Каталогқа өту
          </Link>
        </GlassPanel>

        <GlassPanel className="relative overflow-hidden p-6 ring-1 ring-[rgba(217,183,111,0.42)]">
          <div className="absolute right-5 top-5 rounded-full border border-[rgba(217,183,111,0.26)] bg-[rgba(217,183,111,0.12)] px-3 py-1 text-xs font-bold text-[var(--accent)]">
            Coming soon
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent)]">Premium plan</p>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.018em] text-white">Premium</h2>
          <p className="mt-3 text-sm font-medium leading-6 text-zinc-400">
            Premium контент, таңдаулы сапа және жарнамасыз көру тәжірибесі.
          </p>

          <div className="mt-6 grid gap-3">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 text-sm font-semibold text-zinc-200">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(217,183,111,0.16)] text-[var(--accent)]">
                  <Check className="h-4 w-4" />
                </span>
                {benefit}
              </div>
            ))}
          </div>

          <button
            className="cinema-sweep mt-6 inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black opacity-80"
            type="button"
            disabled
          >
            <Crown className="h-4 w-4" />
            Төлем жақында
          </button>
        </GlassPanel>
      </div>

      <GlassPanel className="mt-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[var(--accent)]">
              <Sparkles className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-zinc-500">Қазіргі статус</p>
              <p className="mt-1 text-lg font-bold text-white">
                {viewer.premium.isPremium ? "Premium белсенді" : "Free"}
              </p>
            </div>
          </div>
          {viewer.premium.isPremium && viewer.premium.endsAt ? (
            <p className="text-sm font-semibold text-zinc-300">
              Жарамды: {formatKazakhDateTime(viewer.premium.endsAt)}
            </p>
          ) : null}
        </div>
      </GlassPanel>
    </main>
  );
}
