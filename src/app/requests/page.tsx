import type { Metadata } from "next";
import { GlassPanel } from "@/components/glass/glass-panel";
import { listContentRequests } from "@/features/requests/repository";
import { getCanonicalUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: "Сұраныстар",
  alternates: {
    canonical: getCanonicalUrl("/requests")
  },
  openGraph: {
    url: getCanonicalUrl("/requests")
  }
};

export const dynamic = "force-dynamic";

const statusLabels = {
  requested: "Дыбыстамаға сұраныс",
  in_progress: "Қазақша нұсқа дайындалуда",
  ready: "Дайын",
  rejected: "Қабылданбады"
};

export default async function RequestsPage() {
  const requests = await listContentRequests();

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <div className="mb-8 max-w-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
          Community roadmap
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.026em] text-white sm:text-5xl">
          Қандай кино керек?
        </h1>
        <p className="mt-4 text-base font-medium leading-7 tracking-[0.004em] text-zinc-300">
          Кино сұраңыз, дауыс жинаңыз. Көп сұралғандары қазақша субтитр немесе
          дыбыстама кезегіне өтеді.
        </p>
      </div>

      <GlassPanel className="mb-6 p-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            placeholder="Кино атауын жазыңыз"
            className="min-h-12 flex-1 rounded-full border border-white/10 bg-white/[0.08] px-5 text-sm font-medium tracking-[0.004em] text-white outline-none placeholder:text-zinc-500 focus:border-white/30"
          />
          <button className="rounded-full bg-white px-6 py-3 text-sm font-bold tracking-[0.014em] text-black transition hover:bg-zinc-200">
            Іздеу
          </button>
        </div>
      </GlassPanel>

      <div className="grid gap-4 md:grid-cols-3">
        {requests.map((request) => {
          const percent = Math.min(100, Math.round((request.votes / request.targetVotes) * 100));

          return (
            <GlassPanel key={request.id} className="p-5">
              <p className="text-sm font-medium tracking-[0.004em] text-zinc-400">{statusLabels[request.status]}</p>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.014em] text-white">{request.title}</h2>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[var(--accent)]"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-zinc-300">
                <span>
                  {request.votes} / {request.targetVotes} дауыс
                </span>
                <button className="glass-button rounded-full px-4 py-2 font-semibold tracking-[0.01em] text-white">
                  Дауыс беру
                </button>
              </div>
            </GlassPanel>
          );
        })}
      </div>
    </main>
  );
}
