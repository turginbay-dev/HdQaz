"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Movie } from "@/types/movie";
export function EpisodesSection({ contentSlug, episodes, selectedEpisodeId }: { contentSlug: string; episodes: NonNullable<Movie["episodes"]>; selectedEpisodeId: string | null }) {
  const selected = episodes.find(episode => episode.id === selectedEpisodeId);
  const [season, setSeason] = useState(selected?.seasonNumber ?? 1);
  useEffect(() => { setSeason(selected?.seasonNumber ?? 1); }, [selected?.seasonNumber, selectedEpisodeId]);
  const seasons = [...new Set(episodes.map(episode => episode.seasonNumber ?? 1))].sort((a, b) => a - b);
  return <section className="episodes-section" aria-labelledby="episodes-title">
    <div className="episode-heading"><h2 id="episodes-title">Сериялар <span>({episodes.length})</span></h2>
      {seasons.length > 1 && <label>Маусым <select value={season} onChange={event => setSeason(Number(event.target.value))}>{seasons.map(value => <option value={value} key={value}>{value}-маусым</option>)}</select></label>}
    </div>
    {selected && <p className="current-episode">Қазір: {selected.seasonNumber ?? 1}-маусым · {selected.episodeNumber}-серия{selected.title ? ` — ${selected.title}` : ""}</p>}
    <div className="episode-list">{episodes.filter(episode => (episode.seasonNumber ?? 1) === season).sort((a,b) => a.episodeNumber - b.episodeNumber).map(episode => <Link prefetch={false} key={episode.id} aria-current={episode.id === selectedEpisodeId ? "page" : undefined} href={`/${contentSlug}?episode=${encodeURIComponent(episode.slug)}#player`} title={episode.title ?? undefined}>{episode.episodeNumber}<span className="sr-only">-серия{episode.title ? `: ${episode.title}` : ""}</span></Link>)}</div>
    {!episodes.length && <p>Сериялар жақында қосылады.</p>}
  </section>;
}
