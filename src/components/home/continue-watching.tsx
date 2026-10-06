import Link from "next/link";
import { MovieImage } from "@/components/movie/movie-image";
import { displayTitles } from "@/lib/viewer-catalog";
import type { ContinueWatchingItem } from "@/features/watch-history/types";
export function ContinueWatching({ isAuthenticated, items }: { isAuthenticated: boolean; items: ContinueWatchingItem[] }) {
  const resumable = items.filter(item => !item.completed && item.progressSeconds >= 30 && item.progressPercent < 90);
  if (!isAuthenticated || !resumable.length) return null;
  return <section className="viewer-section continue-section"><div className="section-heading"><h2>Жалғастырып көру</h2><Link href="/profile">Көру тарихы ↗</Link></div>
    <div className="continue-grid">{resumable.map(item => <Link key={item.id} href={`/${item.movie.slug}#player`} className="continue-item">
      <div className="continue-poster"><MovieImage src={item.movie.backdropUrl} alt="" fallback="backdrop" fill sizes="(max-width:639px) 92vw, 380px" className="object-cover" /><div className="continue-progress"><span style={{width:`${Math.max(0,Math.min(100,item.progressPercent))}%`}} /></div></div>
      <h3>{displayTitles(item.movie).title}</h3><p>{Math.round(item.progressPercent)}% · Жалғастыру</p>
    </Link>)}</div>
  </section>;
}
