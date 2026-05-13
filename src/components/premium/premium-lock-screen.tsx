import Link from "next/link";
import { Crown, LockKeyhole } from "lucide-react";
import { GlassPanel } from "@/components/glass/glass-panel";
import { MovieImage } from "@/components/movie/movie-image";

type PremiumLockScreenProps = {
  backdropUrl: string;
  title: string;
};

export function PremiumLockScreen({ backdropUrl, title }: PremiumLockScreenProps) {
  return (
    <GlassPanel className="relative isolate overflow-hidden p-0">
      <div className="relative aspect-video min-h-[320px] overflow-hidden rounded-[28px]">
        <MovieImage
          src={backdropUrl}
          alt=""
          fallback="backdrop"
          fill
          sizes="(max-width: 1280px) 100vw, 900px"
          className="object-cover opacity-[0.42]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/35" />
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <div className="max-w-xl text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(217,183,111,0.32)] bg-[rgba(217,183,111,0.14)] text-[var(--accent)] backdrop-blur-2xl">
              <LockKeyhole className="h-7 w-7" />
            </span>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
              Premium
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.024em] text-white sm:text-4xl">
              {title}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-6 text-zinc-300">
              Бұл контент Premium жазылымымен ашылады.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/premium"
                className="cinema-sweep inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black transition hover:bg-[#f3ead5]"
              >
                <Crown className="h-4 w-4" />
                Premium қосу
              </Link>
              <Link
                href="/catalog"
                className="glass-button inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-bold text-white"
              >
                Каталогқа қайту
              </Link>
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}
