"use client";

import { useMemo, useState } from "react";
import { Check, Eye, Film, ImageIcon, ListVideo, Pencil, Plus, Save, Trash2 } from "lucide-react";
import {
  contentStatusLabels,
  contentTypeLabels,
  formatDurationMinutes,
  formatEpisodeCount,
  isEpisodicType,
  slugifyContent
} from "@/features/content/format";
import type { Content, ContentStatus, ContentType, Dubber, Episode, Genre } from "@/types/content";

type AdminContent = {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  description: string;
  posterUrl: string;
  bannerUrl: string;
  trailerUrl: string;
  country: string;
  year: string;
  status: ContentStatus;
  ageRating: string;
  durationMinutes: string;
  hlsUrl: string;
  dubberId: string;
  genreIds: string[];
  isPublished: boolean;
  episodes: Episode[];
};

type EpisodeDraft = {
  id: string;
  episodeNumber: string;
  title: string;
  hlsUrl: string;
  thumbnailUrl: string;
  durationMinutes: string;
  isPublished: boolean;
};

type DubberDraft = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  description: string;
  telegramUrl: string;
  vkUrl: string;
  supportUrl: string;
  chatUrl: string;
  isActive: boolean;
};

type ManualMovieAdminProps = {
  dubbers: Dubber[];
  genres: Genre[];
  initialContents: Content[];
};

type ContentApiResponse = {
  data?: Content;
  error?: {
    message?: string;
    details?: unknown;
  };
};

type EpisodeApiResponse = {
  data?: Episode;
  error?: {
    message?: string;
    details?: unknown;
  };
};

type DubberApiResponse = {
  data?: Dubber;
  error?: {
    message?: string;
    details?: unknown;
  };
};

const typeFilterOptions: Array<{ label: string; value: ContentType | "all" }> = [
  { label: "All", value: "all" },
  { label: "Movie", value: "movie" },
  { label: "Dorama", value: "dorama" },
  { label: "Anime", value: "anime" },
  { label: "Series", value: "series" }
];

const statusFilterOptions: Array<{ label: string; value: ContentStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Ongoing", value: "ongoing" },
  { label: "Completed", value: "completed" },
  { label: "Announced", value: "announced" }
];

function createEmptyContent(): AdminContent {
  return {
    id: "",
    title: "",
    slug: "",
    type: "movie",
    description: "",
    posterUrl: "",
    bannerUrl: "",
    trailerUrl: "",
    country: "Қазақстан",
    year: "",
    status: "announced",
    ageRating: "",
    durationMinutes: "",
    hlsUrl: "",
    dubberId: "",
    genreIds: [],
    isPublished: false,
    episodes: []
  };
}

function createEmptyEpisode(nextNumber = 1): EpisodeDraft {
  return {
    id: "",
    episodeNumber: String(nextNumber),
    title: "",
    hlsUrl: "",
    thumbnailUrl: "",
    durationMinutes: "",
    isPublished: true
  };
}

function createEmptyDubber(): DubberDraft {
  return {
    id: "",
    name: "",
    slug: "",
    logoUrl: "",
    description: "",
    telegramUrl: "",
    vkUrl: "",
    supportUrl: "",
    chatUrl: "",
    isActive: true
  };
}

function sortEpisodes(episodes: Episode[]) {
  return [...episodes].sort((left, right) => left.episodeNumber - right.episodeNumber);
}

function toAdminContent(content: Content): AdminContent {
  return {
    id: content.id,
    title: content.title,
    slug: content.slug,
    type: content.type,
    description: content.description,
    posterUrl: content.posterUrl,
    bannerUrl: content.bannerUrl,
    trailerUrl: content.trailerUrl ?? "",
    country: content.country,
    year: String(content.year),
    status: content.status,
    ageRating: content.ageRating ?? "",
    durationMinutes: content.durationMinutes ? String(content.durationMinutes) : "",
    hlsUrl: content.hlsUrl ?? "",
    dubberId: content.dubberId ?? "",
    genreIds: content.genres.map((genre) => genre.id),
    isPublished: content.isPublished,
    episodes: sortEpisodes(content.episodes)
  };
}

function toEpisodeDraft(episode: Episode): EpisodeDraft {
  return {
    id: episode.id,
    episodeNumber: String(episode.episodeNumber),
    title: episode.title ?? "",
    hlsUrl: episode.hlsUrl,
    thumbnailUrl: episode.thumbnailUrl ?? "",
    durationMinutes: episode.durationMinutes ? String(episode.durationMinutes) : "",
    isPublished: episode.isPublished
  };
}

function toDubberDraft(dubber: Dubber): DubberDraft {
  return {
    id: dubber.id,
    name: dubber.name,
    slug: dubber.slug,
    logoUrl: dubber.logoUrl ?? "",
    description: dubber.description ?? "",
    telegramUrl: dubber.telegramUrl ?? "",
    vkUrl: dubber.vkUrl ?? "",
    supportUrl: dubber.supportUrl ?? "",
    chatUrl: dubber.chatUrl ?? "",
    isActive: dubber.isActive
  };
}

function formatValidationDetails(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }

  const entries = Object.entries(details as Record<string, unknown>)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([field, value]) => `${field}: ${value}`);

  return entries.length > 0 ? entries.join(" ") : null;
}

function getApiError(result: ContentApiResponse | EpisodeApiResponse | DubberApiResponse | null, fallback: string) {
  const message = result?.error?.message ?? fallback;
  const details = formatValidationDetails(result?.error?.details);

  return details ? `${message} ${details}` : message;
}

export function ManualMovieAdmin({ dubbers, genres, initialContents }: ManualMovieAdminProps) {
  const [contents, setContents] = useState<Content[]>(initialContents);
  const [availableDubbers, setAvailableDubbers] = useState<Dubber[]>(dubbers);
  const [contentDraft, setContentDraft] = useState<AdminContent>(() => createEmptyContent());
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [episodeDraft, setEpisodeDraft] = useState<EpisodeDraft>(() => createEmptyEpisode());
  const [dubberDraft, setDubberDraft] = useState<DubberDraft>(() => createEmptyDubber());
  const [typeFilter, setTypeFilter] = useState<ContentType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "all">("all");
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isSavingEpisode, setIsSavingEpisode] = useState(false);
  const [isSavingDubber, setIsSavingDubber] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [episodeError, setEpisodeError] = useState<string | null>(null);
  const [dubberError, setDubberError] = useState<string | null>(null);

  const filteredContents = useMemo(
    () =>
      contents.filter((content) => {
        const typeMatches = typeFilter === "all" || content.type === typeFilter;
        const statusMatches = statusFilter === "all" || content.status === statusFilter;

        return typeMatches && statusMatches;
      }),
    [contents, statusFilter, typeFilter]
  );
  const selectedDubber = availableDubbers.find((dubber) => dubber.id === contentDraft.dubberId);
  const selectedGenreNames = genres
    .filter((genre) => contentDraft.genreIds.includes(genre.id))
    .map((genre) => genre.name);
  const nextEpisodeNumber = contentDraft.episodes.length > 0
    ? Math.max(...contentDraft.episodes.map((episode) => episode.episodeNumber)) + 1
    : 1;
  const activeSlug = editingSlug ?? contentDraft.slug;
  const canSaveContent =
    Boolean(
      contentDraft.title &&
        contentDraft.slug &&
        contentDraft.description &&
        contentDraft.posterUrl &&
        contentDraft.bannerUrl &&
        contentDraft.country &&
        contentDraft.year
    ) &&
    contentDraft.genreIds.length > 0 &&
    (!isEpisodicType(contentDraft.type) ? Boolean(contentDraft.hlsUrl) : true);
  const canSaveEpisode =
    Boolean(contentDraft.id && activeSlug && episodeDraft.episodeNumber && episodeDraft.hlsUrl) &&
    isEpisodicType(contentDraft.type);
  const canSaveDubber = Boolean(dubberDraft.name && dubberDraft.slug);

  function updateContentField<T extends keyof AdminContent>(field: T, value: AdminContent[T]) {
    setContentDraft((current) => {
      const next = {
        ...current,
        [field]: value
      };

      if (field === "title" && !current.slug) {
        next.slug = slugifyContent(String(value));
      }

      if (field === "type" && isEpisodicType(value as ContentType)) {
        next.hlsUrl = "";
        next.durationMinutes = "";
      }

      return next;
    });
  }

  function toggleGenre(genreId: string) {
    setContentDraft((current) => ({
      ...current,
      genreIds: current.genreIds.includes(genreId)
        ? current.genreIds.filter((item) => item !== genreId)
        : [...current.genreIds, genreId]
    }));
  }

  function updateDubberField<T extends keyof DubberDraft>(field: T, value: DubberDraft[T]) {
    setDubberDraft((current) => {
      const next = {
        ...current,
        [field]: value
      };

      if (field === "name" && !current.slug) {
        next.slug = slugifyContent(String(value));
      }

      return next;
    });
  }

  function startNewContent() {
    setContentDraft(createEmptyContent());
    setEditingSlug(null);
    setEpisodeDraft(createEmptyEpisode());
    setFormError(null);
    setEpisodeError(null);
  }

  function startNewDubber() {
    setDubberDraft(createEmptyDubber());
    setDubberError(null);
  }

  function startEditContent(content: Content) {
    const nextDraft = toAdminContent(content);

    setContentDraft(nextDraft);
    setEditingSlug(content.slug);
    setEpisodeDraft(createEmptyEpisode(nextDraft.episodes.length + 1));
    setFormError(null);
    setEpisodeError(null);
  }

  function startEditDubber(dubber: Dubber) {
    setDubberDraft(toDubberDraft(dubber));
    setDubberError(null);
  }

  function upsertContent(savedContent: Content) {
    setContents((current) => {
      const exists = current.some((content) => content.id === savedContent.id);
      const next = exists
        ? current.map((content) => (content.id === savedContent.id ? savedContent : content))
        : [savedContent, ...current];

      return next;
    });
  }

  function upsertDubber(savedDubber: Dubber) {
    setAvailableDubbers((current) => {
      const exists = current.some((dubber) => dubber.id === savedDubber.id);
      const next = exists
        ? current.map((dubber) => (dubber.id === savedDubber.id ? savedDubber : dubber))
        : [...current, savedDubber];

      return next.sort((left, right) => left.name.localeCompare(right.name, "kk"));
    });
    setContents((current) =>
      current.map((content) =>
        content.dubberId === savedDubber.id
          ? {
              ...content,
              dubber: savedDubber
            }
          : content
      )
    );
  }

  async function saveDubber() {
    if (!canSaveDubber || isSavingDubber) {
      return;
    }

    setIsSavingDubber(true);
    setDubberError(null);

    try {
      const payload = {
        name: dubberDraft.name,
        slug: dubberDraft.slug || slugifyContent(dubberDraft.name),
        logoUrl: dubberDraft.logoUrl || null,
        description: dubberDraft.description || null,
        telegramUrl: dubberDraft.telegramUrl || null,
        vkUrl: dubberDraft.vkUrl || null,
        supportUrl: dubberDraft.supportUrl || null,
        chatUrl: dubberDraft.chatUrl || null,
        isActive: dubberDraft.isActive
      };
      const response = await fetch(
        dubberDraft.id ? `/api/dubbers/${encodeURIComponent(dubberDraft.id)}` : "/api/dubbers",
        {
          method: dubberDraft.id ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );
      const result = (await response.json().catch(() => null)) as DubberApiResponse | null;
      const savedDubber = result?.data;

      if (!response.ok || !savedDubber) {
        throw new Error(getApiError(result, "Дыбыстама тобын сақтау мүмкін болмады."));
      }

      upsertDubber(savedDubber);
      setDubberDraft(toDubberDraft(savedDubber));
    } catch (error) {
      setDubberError(error instanceof Error ? error.message : "Дыбыстама тобын сақтау мүмкін болмады.");
    } finally {
      setIsSavingDubber(false);
    }
  }

  async function saveContent() {
    if (!canSaveContent || isSavingContent) {
      return;
    }

    setIsSavingContent(true);
    setFormError(null);

    try {
      const payload = {
        title: contentDraft.title,
        slug: contentDraft.slug || slugifyContent(contentDraft.title),
        type: contentDraft.type,
        description: contentDraft.description,
        posterUrl: contentDraft.posterUrl,
        bannerUrl: contentDraft.bannerUrl,
        trailerUrl: contentDraft.trailerUrl || null,
        country: contentDraft.country,
        year: Number(contentDraft.year),
        status: contentDraft.status,
        ageRating: contentDraft.ageRating || null,
        durationMinutes: contentDraft.durationMinutes ? Number(contentDraft.durationMinutes) : null,
        hlsUrl: contentDraft.hlsUrl || null,
        dubberId: contentDraft.dubberId || null,
        genreIds: contentDraft.genreIds,
        isPublished: contentDraft.isPublished
      };
      const response = await fetch(editingSlug ? `/api/contents/${encodeURIComponent(editingSlug)}` : "/api/contents", {
        method: editingSlug ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => null)) as ContentApiResponse | null;
      const savedContent = result?.data;

      if (!response.ok || !savedContent) {
        throw new Error(getApiError(result, "Контентті сақтау мүмкін болмады."));
      }

      upsertContent(savedContent);
      setContentDraft(toAdminContent(savedContent));
      setEditingSlug(savedContent.slug);
      setEpisodeDraft(createEmptyEpisode(savedContent.episodes.length + 1));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Контентті сақтау мүмкін болмады.");
    } finally {
      setIsSavingContent(false);
    }
  }

  function updateLocalEpisodes(nextEpisodes: Episode[]) {
    const sortedEpisodes = sortEpisodes(nextEpisodes);

    setContentDraft((current) => ({
      ...current,
      episodes: sortedEpisodes
    }));
    setContents((current) =>
      current.map((content) =>
        content.id === contentDraft.id
          ? {
              ...content,
              episodes: sortedEpisodes,
              episodeCount: sortedEpisodes.length
            }
          : content
      )
    );
  }

  async function saveEpisode() {
    if (!canSaveEpisode || isSavingEpisode) {
      return;
    }

    setIsSavingEpisode(true);
    setEpisodeError(null);

    try {
      const payload = {
        episodeNumber: Number(episodeDraft.episodeNumber),
        title: episodeDraft.title || null,
        hlsUrl: episodeDraft.hlsUrl,
        thumbnailUrl: episodeDraft.thumbnailUrl || null,
        durationMinutes: episodeDraft.durationMinutes ? Number(episodeDraft.durationMinutes) : null,
        isPublished: episodeDraft.isPublished
      };
      const response = await fetch(
        episodeDraft.id
          ? `/api/contents/${encodeURIComponent(activeSlug)}/episodes/${encodeURIComponent(episodeDraft.id)}`
          : `/api/contents/${encodeURIComponent(activeSlug)}/episodes`,
        {
          method: episodeDraft.id ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );
      const result = (await response.json().catch(() => null)) as EpisodeApiResponse | null;
      const savedEpisode = result?.data;

      if (!response.ok || !savedEpisode) {
        throw new Error(getApiError(result, "Серияны сақтау мүмкін болмады."));
      }

      const nextEpisodes = episodeDraft.id
        ? contentDraft.episodes.map((episode) => (episode.id === savedEpisode.id ? savedEpisode : episode))
        : [...contentDraft.episodes, savedEpisode];

      updateLocalEpisodes(nextEpisodes);
      setEpisodeDraft(createEmptyEpisode(Math.max(nextEpisodeNumber, savedEpisode.episodeNumber + 1)));
    } catch (error) {
      setEpisodeError(error instanceof Error ? error.message : "Серияны сақтау мүмкін болмады.");
    } finally {
      setIsSavingEpisode(false);
    }
  }

  async function deleteEpisode(episode: Episode) {
    if (!activeSlug || isSavingEpisode) {
      return;
    }

    setIsSavingEpisode(true);
    setEpisodeError(null);

    try {
      const response = await fetch(
        `/api/contents/${encodeURIComponent(activeSlug)}/episodes/${encodeURIComponent(episode.id)}`,
        {
          method: "DELETE"
        }
      );

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as EpisodeApiResponse | null;
        throw new Error(getApiError(result, "Серияны өшіру мүмкін болмады."));
      }

      updateLocalEpisodes(contentDraft.episodes.filter((item) => item.id !== episode.id));
      if (episodeDraft.id === episode.id) {
        setEpisodeDraft(createEmptyEpisode(nextEpisodeNumber));
      }
    } catch (error) {
      setEpisodeError(error instanceof Error ? error.message : "Серияны өшіру мүмкін болмады.");
    } finally {
      setIsSavingEpisode(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="glass-strong rounded-[34px] p-5 sm:p-7">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
              Контент
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {contentDraft.id ? "Контентті өңдеу" : "Жаңа контент қосу"}
            </h2>
          </div>
          <button
            className="glass-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-white"
            onClick={startNewContent}
            type="button"
          >
            <Plus className="h-4 w-4" />
            Жаңа
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AdminInput
            label="Атауы"
            value={contentDraft.title}
            onChange={(value) => updateContentField("title", value)}
            placeholder="Moving"
          />
          <AdminInput
            label="Slug"
            value={contentDraft.slug}
            onChange={(value) => updateContentField("slug", value)}
            placeholder="moving"
          />
          <AdminSelect
            label="Түрі"
            value={contentDraft.type}
            onChange={(value) => updateContentField("type", value as ContentType)}
            options={[
              { label: "Movie", value: "movie" },
              { label: "Dorama", value: "dorama" },
              { label: "Anime", value: "anime" },
              { label: "Series", value: "series" }
            ]}
          />
          <AdminSelect
            label="Статус"
            value={contentDraft.status}
            onChange={(value) => updateContentField("status", value as ContentStatus)}
            options={[
              { label: "Ongoing", value: "ongoing" },
              { label: "Completed", value: "completed" },
              { label: "Announced", value: "announced" }
            ]}
          />
          <AdminInput
            label="Елі"
            value={contentDraft.country}
            onChange={(value) => updateContentField("country", value)}
            placeholder="Оңтүстік Корея"
          />
          <AdminInput
            label="Жылы"
            value={contentDraft.year}
            onChange={(value) => updateContentField("year", value)}
            placeholder="2024"
          />
          <AdminInput
            label="Жас рейтингі"
            value={contentDraft.ageRating}
            onChange={(value) => updateContentField("ageRating", value)}
            placeholder="16+"
          />
          {!isEpisodicType(contentDraft.type) ? (
            <AdminInput
              label="Ұзақтығы, минут"
              value={contentDraft.durationMinutes}
              onChange={(value) => updateContentField("durationMinutes", value)}
              placeholder="128"
            />
          ) : null}
          <AdminInput
            label="Постер URL"
            value={contentDraft.posterUrl}
            onChange={(value) => updateContentField("posterUrl", value)}
            placeholder="https://..."
          />
          <AdminInput
            label="Баннер URL"
            value={contentDraft.bannerUrl}
            onChange={(value) => updateContentField("bannerUrl", value)}
            placeholder="https://..."
          />
          <AdminInput
            label="Трейлер URL"
            value={contentDraft.trailerUrl}
            onChange={(value) => updateContentField("trailerUrl", value)}
            placeholder="https://..."
          />
          <AdminSelect
            label="Даббер"
            value={contentDraft.dubberId}
            onChange={(value) => updateContentField("dubberId", value)}
            options={[
              { label: "Таңдалмаған", value: "" },
              ...availableDubbers.map((dubber) => ({ label: dubber.name, value: dubber.id }))
            ]}
          />
          {!isEpisodicType(contentDraft.type) ? (
            <div className="md:col-span-2">
              <AdminInput
                label="Movie HLS URL"
                value={contentDraft.hlsUrl}
                onChange={(value) => updateContentField("hlsUrl", value)}
                placeholder="https://cdn.example.com/movie/master.m3u8"
              />
            </div>
          ) : null}
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-zinc-300">Сипаттама</span>
          <textarea
            value={contentDraft.description}
            onChange={(event) => updateContentField("description", event.target.value)}
            className="mt-2 min-h-32 w-full resize-none rounded-3xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-[rgba(217,183,111,0.45)] focus:bg-white/[0.08]"
            placeholder="Контент туралы қысқа сипаттама..."
          />
        </label>

        <AdminPillGroup
          label="Жанрлар"
          items={genres.map((genre) => ({ id: genre.id, label: genre.name }))}
          selected={contentDraft.genreIds}
          onToggle={toggleGenre}
        />

        <div className="mt-5 flex flex-wrap gap-3">
          <AdminToggle
            label="Жарияланған"
            active={contentDraft.isPublished}
            onClick={() => updateContentField("isPublished", !contentDraft.isPublished)}
          />
        </div>

        <button
          className="cinema-sweep mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black shadow-[0_18px_70px_rgba(255,255,255,0.16)] transition hover:bg-[#f3ead5] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={!canSaveContent || isSavingContent}
          onClick={saveContent}
          type="button"
        >
          <Save className="h-4 w-4" />
          {isSavingContent ? "Сақталып жатыр..." : "Контентті сақтау"}
        </button>
        {formError ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-red-300">
            {formError}
          </p>
        ) : null}

        {isEpisodicType(contentDraft.type) ? (
          <section className="mt-8 border-t border-white/10 pt-7">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
                  Episodes
                </p>
                <h3 className="mt-2 text-xl font-semibold text-white">Сериялар</h3>
              </div>
              <button
                className="glass-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-white"
                onClick={() => setEpisodeDraft(createEmptyEpisode(nextEpisodeNumber))}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Add Episode
              </button>
            </div>

            {!contentDraft.id ? (
              <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-zinc-400">
                Алдымен dorama/series/anime контентін сақтаңыз. Содан кейін серияларды осы жерде қосасыз.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid gap-3">
                  {contentDraft.episodes.length > 0 ? (
                    contentDraft.episodes.map((episode) => (
                      <article key={episode.id} className="glass flex flex-col gap-3 rounded-[24px] p-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-white">
                            Episode {episode.episodeNumber}
                            {episode.title ? ` — ${episode.title}` : ""}
                          </h4>
                          <p className="mt-1 truncate text-xs text-zinc-500">
                            /watch/{contentDraft.slug}/{episode.slug}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusPill active={episode.isPublished} label={episode.isPublished ? "Published" : "Draft"} />
                          <button
                            className="glass-button flex h-10 w-10 items-center justify-center rounded-full text-white"
                            onClick={() => setEpisodeDraft(toEpisodeDraft(episode))}
                            aria-label="Edit episode"
                            type="button"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            className="glass-button flex h-10 w-10 items-center justify-center rounded-full text-red-200"
                            onClick={() => void deleteEpisode(episode)}
                            aria-label="Delete episode"
                            type="button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-sm text-zinc-400">
                      Сериялар жақында қосылады
                    </div>
                  )}
                </div>

                <div className="glass rounded-[26px] p-4">
                  <h4 className="mb-4 font-semibold text-white">
                    {episodeDraft.id ? "Серияны өңдеу" : "Серия қосу"}
                  </h4>
                  <div className="grid gap-3">
                    <AdminInput
                      label="Episode number"
                      value={episodeDraft.episodeNumber}
                      onChange={(value) => setEpisodeDraft((current) => ({ ...current, episodeNumber: value }))}
                      placeholder="1"
                    />
                    <AdminInput
                      label="Episode title"
                      value={episodeDraft.title}
                      onChange={(value) => setEpisodeDraft((current) => ({ ...current, title: value }))}
                      placeholder="Optional"
                    />
                    <AdminInput
                      label="HLS URL"
                      value={episodeDraft.hlsUrl}
                      onChange={(value) => setEpisodeDraft((current) => ({ ...current, hlsUrl: value }))}
                      placeholder="https://cdn.example.com/dorama/1/master.m3u8"
                    />
                    <AdminInput
                      label="Thumbnail URL"
                      value={episodeDraft.thumbnailUrl}
                      onChange={(value) => setEpisodeDraft((current) => ({ ...current, thumbnailUrl: value }))}
                      placeholder="Optional"
                    />
                    <AdminInput
                      label="Duration, minutes"
                      value={episodeDraft.durationMinutes}
                      onChange={(value) => setEpisodeDraft((current) => ({ ...current, durationMinutes: value }))}
                      placeholder="64"
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <AdminToggle
                      label="Published"
                      active={episodeDraft.isPublished}
                      onClick={() => setEpisodeDraft((current) => ({ ...current, isPublished: !current.isPublished }))}
                    />
                  </div>
                  <button
                    className="hero-watch-button mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canSaveEpisode || isSavingEpisode}
                    onClick={saveEpisode}
                    type="button"
                  >
                    <Save className="h-4 w-4" />
                    {isSavingEpisode ? "Saving..." : "Save episode"}
                  </button>
                  {episodeError ? (
                    <p className="mt-3 text-sm leading-6 text-red-300">{episodeError}</p>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        ) : null}
      </section>

      <aside className="space-y-4">
        <section className="glass rounded-[30px] p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(217,183,111,0.16)] text-[var(--accent)]">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Алдын ала көру</h3>
              <p className="text-xs text-zinc-500">Постер URL енгізсең көрінеді</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.045]">
            {contentDraft.posterUrl ? (
              <img src={contentDraft.posterUrl} alt={contentDraft.title || "Poster preview"} className="aspect-[2/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center text-zinc-600">
                <ImageIcon className="h-10 w-10" />
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill active label={contentTypeLabels[contentDraft.type]} />
            <StatusPill active={contentDraft.status !== "announced"} label={contentStatusLabels[contentDraft.status]} />
          </div>
          <h3 className="mt-3 truncate text-lg font-semibold text-white">{contentDraft.title || "Контент атауы"}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {contentDraft.year || "Жыл"} · {contentDraft.country || "Ел"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {isEpisodicType(contentDraft.type)
              ? formatEpisodeCount(contentDraft.episodes.length) || "Сериялар жоқ"
              : formatDurationMinutes(Number(contentDraft.durationMinutes)) || "Ұзақтығы жоқ"}
          </p>
          {selectedDubber ? <p className="mt-1 text-sm text-[var(--accent)]">{selectedDubber.name}</p> : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {selectedGenreNames.slice(0, 4).map((genre) => (
              <span key={genre} className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                {genre}
              </span>
            ))}
          </div>
        </section>

        <section className="glass rounded-[30px] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">Дыбыстама топтары</h3>
              <p className="mt-1 text-xs text-zinc-500">{availableDubbers.length} даббер</p>
            </div>
            <button
              className="glass-button flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
              onClick={startNewDubber}
              aria-label="Жаңа дыбыстама тобын қосу"
              type="button"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3">
            <AdminInput
              label="Топ атауы"
              value={dubberDraft.name}
              onChange={(value) => updateDubberField("name", value)}
              placeholder="Qazaq Dub"
            />
            <AdminInput
              label="Slug"
              value={dubberDraft.slug}
              onChange={(value) => updateDubberField("slug", value)}
              placeholder="qazaq-dub"
            />
            <AdminInput
              label="Лого URL"
              value={dubberDraft.logoUrl}
              onChange={(value) => updateDubberField("logoUrl", value)}
              placeholder="https://..."
            />
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Сипаттама</span>
              <textarea
                value={dubberDraft.description}
                onChange={(event) => updateDubberField("description", event.target.value)}
                className="mt-2 min-h-24 w-full resize-none rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-[rgba(217,183,111,0.45)] focus:bg-white/[0.08]"
                placeholder="Команда туралы қысқаша..."
              />
            </label>
            <AdminInput
              label="Telegram URL"
              value={dubberDraft.telegramUrl}
              onChange={(value) => updateDubberField("telegramUrl", value)}
              placeholder="https://t.me/..."
            />
            <AdminInput
              label="VK URL"
              value={dubberDraft.vkUrl}
              onChange={(value) => updateDubberField("vkUrl", value)}
              placeholder="https://vk.com/..."
            />
            <AdminInput
              label="Support URL"
              value={dubberDraft.supportUrl}
              onChange={(value) => updateDubberField("supportUrl", value)}
              placeholder="https://..."
            />
            <AdminInput
              label="Chat URL"
              value={dubberDraft.chatUrl}
              onChange={(value) => updateDubberField("chatUrl", value)}
              placeholder="https://..."
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <AdminToggle
              label={dubberDraft.isActive ? "Белсенді" : "Жасырылған"}
              active={dubberDraft.isActive}
              onClick={() => updateDubberField("isActive", !dubberDraft.isActive)}
            />
          </div>

          <button
            className="hero-watch-button mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSaveDubber || isSavingDubber}
            onClick={saveDubber}
            type="button"
          >
            <Save className="h-4 w-4" />
            {isSavingDubber ? "Сақталып жатыр..." : dubberDraft.id ? "Топты сақтау" : "Топ қосу"}
          </button>
          {dubberError ? (
            <p className="mt-3 text-sm leading-6 text-red-300">{dubberError}</p>
          ) : null}

          <div className="mt-5 divide-y divide-white/10 border-t border-white/10">
            {availableDubbers.length > 0 ? (
              availableDubbers.map((dubber) => (
                <div key={dubber.id} className="flex items-center gap-3 py-3">
                  {dubber.logoUrl ? (
                    <img src={dubber.logoUrl} alt={dubber.name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-[var(--accent)]">
                      {dubber.name.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{dubber.name}</p>
                    <p className="truncate text-xs text-zinc-500">{dubber.slug}</p>
                  </div>
                  <StatusPill active={dubber.isActive} label={dubber.isActive ? "Active" : "Hidden"} />
                  <button
                    className="glass-button flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                    onClick={() => startEditDubber(dubber)}
                    aria-label={`${dubber.name} өңдеу`}
                    type="button"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              ))
            ) : (
              <p className="py-3 text-sm text-zinc-500">Әзірге даббер жоқ</p>
            )}
          </div>
        </section>

        <section className="glass rounded-[30px] p-5">
          <h3 className="mb-4 font-semibold text-white">Architecture checklist</h3>
          {[
            "Movie HLS URL тек movie түрінде сақталады",
            "Dorama, series және anime сериялары бөлек episodes кестесінде",
            "Episode slug бос болса episode_number арқылы толады",
            "Public беттер published контент пен published серияларды ғана көрсетеді",
            "Бір dorama бір detail page және бір episode list алады"
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 border-t border-white/10 py-3 first:border-t-0 first:pt-0">
              <Check className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-sm text-zinc-300">{item}</span>
            </div>
          ))}
        </section>
      </aside>

      <section className="xl:col-span-2">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
              Contents
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Контент тізімі</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {typeFilterOptions.map((option) => (
              <FilterButton
                key={option.value}
                active={typeFilter === option.value}
                label={option.label}
                onClick={() => setTypeFilter(option.value)}
              />
            ))}
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {statusFilterOptions.map((option) => (
            <FilterButton
              key={option.value}
              active={statusFilter === option.value}
              label={option.label}
              onClick={() => setStatusFilter(option.value)}
            />
          ))}
        </div>

        <div className="grid gap-3">
          {filteredContents.map((item) => (
            <article
              key={item.id}
              className="glass flex flex-col gap-4 rounded-[26px] p-3 sm:flex-row sm:items-center"
            >
              <img
                src={item.posterUrl}
                alt={item.title}
                className="h-28 w-20 rounded-2xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap gap-2">
                  <StatusPill active label={contentTypeLabels[item.type]} />
                  <StatusPill active={item.status !== "announced"} label={contentStatusLabels[item.status]} />
                  <StatusPill active={item.isPublished} label={item.isPublished ? "Published" : "Draft"} />
                </div>
                <h3 className="truncate font-semibold text-white">{item.title}</h3>
                <p className="mt-1 truncate text-sm text-zinc-500">
                  {item.year} · {item.country || "Ел жоқ"} · {item.dubber?.name ?? "Даббер жоқ"}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-600">
                  {item.genres.map((genre) => genre.name).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="glass hidden h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-zinc-300 sm:flex">
                  {isEpisodicType(item.type) ? <ListVideo className="h-4 w-4" /> : <Film className="h-4 w-4" />}
                  {isEpisodicType(item.type)
                    ? formatEpisodeCount(item.episodeCount) || "0 серия"
                    : formatDurationMinutes(item.durationMinutes) || "Movie"}
                </div>
                <button
                  className="glass-button inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-white"
                  onClick={() => startEditContent(item)}
                  type="button"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminPillGroup({
  items,
  label,
  onToggle,
  selected
}: {
  items: Array<{ id: string; label: string }>;
  label: string;
  onToggle: (value: string) => void;
  selected: string[];
}) {
  return (
    <div className="mt-5">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      <div className="mt-2 flex flex-wrap gap-2 rounded-[26px] border border-white/10 bg-white/[0.04] p-3">
        {items.map((item) => {
          const active = selected.includes(item.id);

          return (
            <button
              key={item.id}
              className={
                active
                  ? "rounded-full border border-[rgba(217,183,111,0.36)] bg-[rgba(217,183,111,0.16)] px-3 py-2 text-xs font-semibold text-[var(--accent)]"
                  : "rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:border-white/20 hover:text-white"
              }
              onClick={() => onToggle(item.id)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AdminInput({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[rgba(217,183,111,0.45)] focus:bg-white/[0.08]"
        placeholder={placeholder}
      />
    </label>
  );
}

function AdminSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-full border border-white/10 bg-[#111116] px-4 text-sm text-white outline-none transition focus:border-[rgba(217,183,111,0.45)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AdminToggle({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={
        active
          ? "rounded-full border border-[rgba(217,183,111,0.38)] bg-[rgba(217,183,111,0.16)] px-4 py-2 text-sm font-semibold text-[var(--accent)]"
          : "glass-button rounded-full px-4 py-2 text-sm font-semibold text-zinc-300"
      }
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function FilterButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={
        active
          ? "rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
          : "glass-button rounded-full px-4 py-2 text-sm font-semibold text-white"
      }
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={
        active
          ? "rounded-full border border-[rgba(217,183,111,0.34)] bg-[rgba(217,183,111,0.14)] px-3 py-1 text-xs font-semibold text-[var(--accent)]"
          : "rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-400"
      }
    >
      {label}
    </span>
  );
}
