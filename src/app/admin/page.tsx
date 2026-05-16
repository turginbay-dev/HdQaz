import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Film, FolderKanban, ShieldAlert, Tags } from "lucide-react";
import { ManualMovieAdmin } from "@/components/admin/manual-movie-admin";
import { LogoMark } from "@/components/layout/site-logo";
import { listContents, listDubbers, listGenres } from "@/features/content/repository";
import { getCurrentAdminUser } from "@/lib/admin-access";

export const metadata = {
  title: "Admin"
};

export default async function AdminPage() {
  const adminUser = await getCurrentAdminUser();

  if (!adminUser) {
    notFound();
  }

  const [initialContents, genres, dubbers] = await Promise.all([
    listContents({ includeDrafts: true }),
    listGenres(),
    listDubbers({ includeInactive: true })
  ]);

  return (
    <main className="ambient-page min-h-screen px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link
              href="/"
              className="glass-button mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold tracking-[0.01em] text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Басты бет
            </Link>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
              <LogoMark className="h-8 w-12 p-0.5" sizes="48px" />
              HdQaz Admin
            </p>
            <h1 className="mt-3 break-words font-bold leading-[0.96] tracking-[-0.032em] text-white [font-size:clamp(2.4rem,12vw,3.4rem)] sm:[font-size:clamp(3rem,6.6vw,6rem)]">
              Контент басқару панелі
            </h1>
            <p className="mt-5 max-w-2xl text-base font-medium leading-7 tracking-[0.004em] text-zinc-400">
              Контент сақтау `/api/contents` backend endpoint арқылы жүреді. Жазу операциялары
              `.env.local` ішіндегі admin email allowlist арқылы қорғалады.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:w-[560px]">
            <AdminMetric icon={<Film className="h-5 w-5" />} label="Contents" value={String(initialContents.length)} />
            <AdminMetric icon={<Tags className="h-5 w-5" />} label="Genres" value={String(genres.length)} />
            <AdminMetric icon={<FolderKanban className="h-5 w-5" />} label="Дыбыстаушылар" value={String(dubbers.length)} />
            <AdminMetric icon={<ShieldAlert className="h-5 w-5" />} label="Guard" value="Email" />
          </div>
        </div>

        <ManualMovieAdmin initialContents={initialContents} genres={genres} dubbers={dubbers} />
      </section>
    </main>
  );
}

function AdminMetric({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="glass rounded-[24px] p-4">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-[var(--accent)]">
        {icon}
      </div>
      <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
