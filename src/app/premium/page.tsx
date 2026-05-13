import { Check } from "lucide-react";
import { GlassPanel } from "@/components/glass/glass-panel";
import { LogoMark } from "@/components/layout/site-logo";

export const metadata = {
  title: "Premium"
};

const plans = [
  {
    name: "1 ай",
    price: "1199 ₸",
    featured: false
  },
  {
    name: "2 ай",
    price: "1799 ₸",
    featured: false
  },
  {
    name: "3 ай",
    price: "2199 ₸",
    featured: true
  }
];

const benefits = [
  "Шексіз 1080p көру",
  "Telegram арқылы күніне 4 файлға дейін жүктеу",
  "Жарнамасыз интерфейс",
  "Premium сұраныстарға басымдық"
];

export default function PremiumPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <LogoMark className="mx-auto mb-4 h-20 w-20 p-1.5" sizes="80px" />
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
          HdQaz Premium
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.026em] text-white sm:text-6xl">
          Қазақша киноны толық сапада көріңіз
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <GlassPanel
            key={plan.name}
            className={plan.featured ? "p-6 ring-1 ring-[var(--accent)]" : "p-6"}
          >
            {plan.featured && (
              <span className="mb-4 inline-flex rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold tracking-[0.012em] text-black">
                Ең тиімді
              </span>
            )}
            <h2 className="text-xl font-bold tracking-[-0.014em] text-white">{plan.name}</h2>
            <p className="mt-3 text-4xl font-bold tracking-[-0.02em] text-white">
              {plan.price}
            </p>
            <button className="mt-6 w-full rounded-full bg-white px-5 py-3 text-sm font-bold tracking-[0.014em] text-black transition hover:bg-zinc-200">
              Таңдау
            </button>
          </GlassPanel>
        ))}
      </div>

      <GlassPanel className="mt-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {benefits.map((benefit) => (
            <div key={benefit} className="flex items-center gap-3 text-sm text-zinc-200">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[var(--accent)]">
                <Check className="h-4 w-4" />
              </span>
              {benefit}
            </div>
          ))}
        </div>
      </GlassPanel>
    </main>
  );
}
