import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Crown, LogOut, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { ProfileMovieSection } from "@/components/profile/profile-movie-section";
import { ProfileNameEditor } from "@/components/profile/profile-name-editor";
import { UserAvatar } from "@/components/user/user-avatar";
import { listUserComments, listUserMovieIds } from "@/features/engagement/repository";
import { getAllMovies } from "@/features/movies/queries";
import { getViewerContext } from "@/features/users/session";
import { getCanonicalUrl } from "@/lib/site-url";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { formatKazakhDateTime, formatKazakhRelativeTime } from "@/lib/formatters";
import type { Movie } from "@/types/movie";

export const metadata: Metadata = {
  title: "Профиль",
  alternates: {
    canonical: getCanonicalUrl("/profile")
  },
  openGraph: {
    url: getCanonicalUrl("/profile")
  }
};

function orderedMovies(ids: string[], movies: Movie[]) {
  const movieById = new Map(movies.map((movie) => [movie.id, movie]));

  return ids.map((id) => movieById.get(id)).filter((movie): movie is Movie => Boolean(movie));
}

export default async function ProfilePage() {
  const config = getSupabaseConfig();

  if (!config.configured) {
    redirect("/login?error=supabase_not_configured");
  }

  const viewer = await getViewerContext();

  if (!viewer.user) {
    redirect("/login");
  }

  const [movies, watchlistIds, likedIds, comments] = await Promise.all([
    getAllMovies(),
    listUserMovieIds("movie_watchlist", viewer.user.id),
    listUserMovieIds("movie_likes", viewer.user.id),
    listUserComments(viewer.user.id, 20)
  ]);

  const watchlistMovies = orderedMovies(watchlistIds, movies);
  const likedMovies = orderedMovies(likedIds, movies);
  const displayName = viewer.profile?.displayName?.trim() || "HdQaz қолданушысы";
  const joinedAt = viewer.profile?.createdAt ?? viewer.user.created_at;

  return (
    <main className="ambient-page min-h-screen px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <section className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="glass-strong h-fit rounded-[34px] p-6 lg:sticky lg:top-28">
          <UserAvatar
            avatarUrl={viewer.profile?.avatarUrl}
            displayName={displayName}
            className="h-24 w-24"
            priority
            sizes="96px"
          />

          <div className="mt-5">
            <ProfileNameEditor initialName={displayName} />
          </div>

          <p className="mt-4 flex min-w-0 items-start gap-2 text-sm font-medium tracking-[0.004em] text-zinc-400">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 break-all">{viewer.user.email}</span>
          </p>
          <p className="mt-2 text-sm font-medium tracking-[0.004em] text-zinc-500">
            Қосылған күні: {joinedAt ? formatKazakhDateTime(joinedAt) : "Белгісіз"}
          </p>

          <div className="mt-6 rounded-[24px] border border-white/10 bg-white/[0.045] p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(217,183,111,0.16)] text-[var(--accent)]">
                <Crown className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Premium статус</p>
                <p className="mt-1 text-base font-bold text-white">
                  {viewer.premium.isPremium ? "Premium белсенді" : "Free"}
                </p>
              </div>
            </div>
            {viewer.premium.isPremium && viewer.premium.endsAt ? (
              <p className="mt-3 text-sm text-zinc-400">Жарамды: {formatKazakhDateTime(viewer.premium.endsAt)}</p>
            ) : (
              <Link
                href="/premium"
                className="glass-button mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 text-sm font-bold text-white"
              >
                Premium қосу
              </Link>
            )}
          </div>

          {viewer.isAdmin ? (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[rgba(217,183,111,0.24)] bg-[rgba(217,183,111,0.1)] px-4 py-3 text-sm font-semibold text-[var(--accent)]">
              <ShieldCheck className="h-4 w-4" />
              Admin
            </div>
          ) : null}

          <form action={signOut} className="mt-6">
            <button
              className="glass-button inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-bold tracking-[0.014em] text-white"
              type="submit"
            >
              <LogOut className="h-4 w-4" />
              Шығу
            </button>
          </form>
        </aside>

        <div className="grid gap-6">
          <ProfileMovieSection title="Менің тізімім" movies={watchlistMovies} variant="watchlist" emptyCta />
          <ProfileMovieSection title="Ұнағандар" movies={likedMovies} variant="likes" emptyCta />

          <section className="glass rounded-[30px] p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-[var(--accent)]">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold tracking-[-0.018em] text-white">Пікірлерім</h2>
                <p className="mt-1 text-xs font-medium text-zinc-500">{comments.length} пікір</p>
              </div>
            </div>

            {comments.length > 0 ? (
              <div className="grid gap-3">
                {comments.map((comment) => (
                  <Link
                    key={comment.id}
                    href={comment.movieSlug ? `/${comment.movieSlug}#comments` : "/catalog"}
                    className="rounded-[24px] border border-white/10 bg-black/20 p-4 transition hover:border-[rgba(217,183,111,0.32)] hover:bg-white/[0.06]"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-white">{comment.movieTitle ?? "Контент"}</p>
                      <time className="text-xs text-zinc-500" dateTime={comment.createdAt} suppressHydrationWarning>
                        {formatKazakhRelativeTime(comment.createdAt)}
                      </time>
                      {comment.isSpoiler ? (
                        <span className="rounded-full border border-[rgba(217,183,111,0.24)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
                          Спойлер
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-300">
                      {comment.isHidden ? "Бұл пікір модерация арқылы жасырылды." : comment.body}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-white/10 bg-black/20 px-5 py-8 text-center">
                <p className="text-sm font-semibold text-zinc-300">Әзірге ештеңе жоқ</p>
                <Link
                  href="/catalog"
                  className="glass-button mt-4 inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-bold text-white"
                >
                  Каталогқа өту
                </Link>
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
