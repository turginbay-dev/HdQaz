import Link from "next/link";
import { Settings2 } from "lucide-react";

export function AdminShortcut() {
  return (
    <section className="relative">
      <Link
        href="/admin"
        className="cinema-sweep glass-strong flex items-center justify-between gap-4 rounded-[28px] p-4 transition hover:-translate-y-1 sm:p-5"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(217,183,111,0.16)] text-[var(--accent)]">
            <Settings2 className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Admin</p>
            <p className="mt-1 text-sm text-zinc-500">Контент басқару панелі</p>
          </div>
        </div>
        <span className="hidden rounded-full bg-white px-4 py-2 text-sm font-semibold text-black sm:inline-flex">
          Кіру
        </span>
      </Link>
    </section>
  );
}
