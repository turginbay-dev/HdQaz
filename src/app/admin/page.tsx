import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Film, FolderKanban, Settings2, ShieldAlert, Tags } from "lucide-react";
import { ManualMovieAdmin } from "@/components/admin/manual-movie-admin";
import { getAllMovies } from "@/features/movies/queries";
import { movieCatalogs, movieGenres } from "@/lib/movie-taxonomy";

export const metadata = {
  title: "Admin"
};

export default function AdminPage() {
  return (
    <main className="ambient-page min-h-screen px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link
              href="/"
              className="glass-button mb-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Басты бет
            </Link>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
              <Settings2 className="h-4 w-4" />
              HdQaz Admin
            </p>
            <h1 className="mt-3 font-semibold leading-[0.95] tracking-[-0.05em] text-white [font-size:clamp(3rem,7vw,6rem)]">
              Контент басқару панелі
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
              Әзірге Google auth қосылмағандықтан бұл панель ашық тұр. Кейін `/admin`
              тек admin email allowlist арқылы қорғалады.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:w-[560px]">
            <AdminMetric icon={<Film className="h-5 w-5" />} label="Movies" value="Manual" />
            <AdminMetric icon={<Tags className="h-5 w-5" />} label="Genres" value={String(movieGenres.length)} />
            <AdminMetric icon={<FolderKanban className="h-5 w-5" />} label="Catalogs" value={String(movieCatalogs.length)} />
            <AdminMetric icon={<ShieldAlert className="h-5 w-5" />} label="Guard" value="Off" />
          </div>
        </div>

        <ManualMovieAdmin initialMovies={getAllMovies()} />
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
