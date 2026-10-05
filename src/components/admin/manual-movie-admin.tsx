"use client";

import { useMemo, useState } from "react";
import { Check, Eye, Film, ImageIcon, ListVideo, Pencil, Plus, Save, Trash2 } from "lucide-react";
import {
  canHaveEpisodes,
  contentReleaseFormatLabels,
  contentStatusLabels,
  contentTypeLabels,
  formatDurationMinutes,
  formatEpisodeCount,
  isEpisodicContent,
  slugifyContent
} from "@/features/content/format";
import type { ContentReleaseFormat } from "@/features/content/format";
import type { Content, ContentStatus, ContentType, Dubber, Episode, Genre, Season } from "@/types/content";

type AdminContent = {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  section: "default" | "anime" | "dorama";
  releaseFormat: ContentReleaseFormat;
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
  introStartSeconds: string;
  introEndSeconds: string;
  dubberId: string;
  genreIds: string[];
  heroComment: string;
  heroOrder: string;
  isHero: boolean;
  hasKazakhSubtitles: boolean;
  isPremium: boolean;
  isPublished: boolean;
  episodes: Episode[];
  seasons: Season[];
};

type EpisodeDraft = {
  id: string;
  seasonId: string;
  episodeNumber: string;
  title: string;
  hlsUrl: string;
  thumbnailUrl: string;
  durationMinutes: string;
  introStartSeconds: string;
  introEndSeconds: string;
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
  readyContentIds?: string[];
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
  { label: "Бәрі", value: "all" },
  { label: "Фильм", value: "movie" },
  { label: "Мультфильм", value: "cartoon" },
  { label: "Дорама", value: "dorama" },
  { label: "Аниме", value: "anime" },
  { label: "Сериал", value: "series" }
];

const releaseFormatOptions: Array<{ label: string; value: ContentReleaseFormat }> = [
  { label: contentReleaseFormatLabels.feature, value: "feature" },
  { label: contentReleaseFormatLabels.episodic, value: "episodic" }
];

const statusFilterOptions: Array<{ label: string; value: ContentStatus | "all" }> = [
  { label: "Бәрі", value: "all" },
  { label: "Жалғасуда", value: "ongoing" },
  { label: "Аяқталған", value: "completed" },
  { label: "Жақында", value: "announced" }
];

function createEmptyContent(): AdminContent {
  return {
    id: "",
    title: "",
    slug: "",
    type: "movie",
    section: "default",
    releaseFormat: "feature",
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
    introStartSeconds: "",
    introEndSeconds: "",
    dubberId: "",
    genreIds: [],
    heroComment: "",
    heroOrder: "",
    isHero: false,
    hasKazakhSubtitles: true,
    isPremium: false,
    isPublished: false,
    seasons: [],
    episodes: []
  };
}

function createEmptyEpisode(nextNumber = 1, seasonId = ""): EpisodeDraft {
  return {
    id: "",
    seasonId,
    episodeNumber: String(nextNumber),
    title: "",
    hlsUrl: "",
    thumbnailUrl: "",
    durationMinutes: "",
    introStartSeconds: "",
    introEndSeconds: "",
    isPublished: false
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
  return [...episodes].sort((left, right) => (left.seasonNumber ?? 0) - (right.seasonNumber ?? 0) || left.episodeNumber - right.episodeNumber);
}

function getReleaseFormat(content: Content): ContentReleaseFormat {
  return isEpisodicContent({ ...content, type: content.storageType ?? content.type }) ? "episodic" : "feature";
}

function supportsReleaseFormatSwitch(type: ContentType) {
  return type === "anime" || type === "dorama";
}

function isEpisodicDraft(content: AdminContent) {
  return content.type !== "movie" && content.type !== "cartoon" && content.releaseFormat === "episodic";
}

function toAdminContent(content: Content): AdminContent {
  return {
    id: content.id,
    title: content.title,
    slug: content.slug,
    type: getReleaseFormat(content) === "episodic" ? "series" : "movie",
    section: content.section ?? (content.type === "anime" || content.type === "dorama" ? content.type : "default"),
    releaseFormat: getReleaseFormat(content),
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
    introStartSeconds: content.introStartSeconds !== null && content.introStartSeconds !== undefined ? String(content.introStartSeconds) : "",
    introEndSeconds: content.introEndSeconds !== null && content.introEndSeconds !== undefined ? String(content.introEndSeconds) : "",
    dubberId: content.dubberId ?? "",
    genreIds: content.genres.map((genre) => genre.id),
    heroComment: content.heroComment ?? "",
    heroOrder: content.heroOrder !== null && content.heroOrder !== undefined ? String(content.heroOrder) : "",
    isHero: Boolean(content.isHero),
    hasKazakhSubtitles: Boolean(content.hasKazakhSubtitles),
    isPremium: content.isPremium,
    isPublished: content.isPublished,
    seasons: content.seasons,
    episodes: sortEpisodes(content.episodes)
  };
}

function toEpisodeDraft(episode: Episode): EpisodeDraft {
  return {
    id: episode.id,
    seasonId: episode.seasonId ?? "",
    episodeNumber: String(episode.episodeNumber),
    title: episode.title ?? "",
    hlsUrl: episode.hlsUrl ?? "",
    thumbnailUrl: episode.thumbnailUrl ?? "",
    durationMinutes: episode.durationMinutes ? String(episode.durationMinutes) : "",
    introStartSeconds: episode.introStartSeconds !== null && episode.introStartSeconds !== undefined ? String(episode.introStartSeconds) : "",
    introEndSeconds: episode.introEndSeconds !== null && episode.introEndSeconds !== undefined ? String(episode.introEndSeconds) : "",
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

export function ManualMovieAdmin({ dubbers, genres, initialContents, readyContentIds = [] }: ManualMovieAdminProps) {
  const [deletePending, setDeletePending] = useState<Content | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [search, setSearch] = useState("");
  const [publication, setPublication] = useState("all");
  const [page, setPage] = useState(0);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [listError, setListError] = useState("");
  const [contents, setContents] = useState<Content[]>(initialContents);
  const [availableDubbers, setAvailableDubbers] = useState<Dubber[]>(dubbers);
  const [contentDraft, setContentDraft] = useState<AdminContent>(() => createEmptyContent());
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [episodeDraft, setEpisodeDraft] = useState<EpisodeDraft>(() => createEmptyEpisode());
  const [dubberDraft, setDubberDraft] = useState<DubberDraft>(() => createEmptyDubber());
  const [typeFilter, setTypeFilter] = useState<ContentType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "all">("all");
  const [seasonNumber, setSeasonNumber] = useState("");
  const [isSavingSeason, setIsSavingSeason] = useState(false);
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [isSavingEpisode, setIsSavingEpisode] = useState(false);
  const [isSavingDubber, setIsSavingDubber] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [episodeError, setEpisodeError] = useState<string | null>(null);
  const [dubberError, setDubberError] = useState<string | null>(null);

  const filteredContents = useMemo(
    () =>
      contents.filter((content) => {
        const typeMatches = typeFilter === "all" || (typeFilter === "movie" || typeFilter === "series" ? getReleaseFormat(content) === (typeFilter === "series" ? "episodic" : "feature") : content.type === typeFilter);
        const statusMatches = statusFilter === "all" || content.status === statusFilter;

        return typeMatches && statusMatches && content.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (publication === "all" || (publication === "ready" ? readyContentIds.includes(content.id) && !content.isPublished : content.isPublished === (publication === "published")));
      }),
    [contents, statusFilter, typeFilter, search, publication, readyContentIds]
  );
  const selectedDubber = availableDubbers.find((dubber) => dubber.id === contentDraft.dubberId);
  const selectedGenreNames = genres
    .filter((genre) => contentDraft.genreIds.includes(genre.id))
    .map((genre) => genre.name);
  const seasonEpisodes = contentDraft.episodes.filter((episode) => (episode.seasonId ?? "") === episodeDraft.seasonId);
  const nextEpisodeNumber = seasonEpisodes.length > 0
    ? Math.max(...seasonEpisodes.map((episode) => episode.episodeNumber)) + 1
    : 1;
  const activeSlug = editingSlug ?? contentDraft.slug;
  const draftIsEpisodic = isEpisodicDraft(contentDraft);
  const canSaveContent = Boolean(contentDraft.title.trim() && contentDraft.slug.trim() && contentDraft.year) &&
    (!contentDraft.isPublished || draftIsEpisodic || Boolean(contentDraft.hlsUrl.trim()));
  const canSaveEpisode =
    Boolean(contentDraft.id && activeSlug && episodeDraft.episodeNumber && (!episodeDraft.isPublished || episodeDraft.hlsUrl.trim())) &&
    draftIsEpisodic &&
    canHaveEpisodes(contentDraft.type);
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

      if (field === "type") {
        const nextType = value as ContentType;

        if (nextType === "series") {
          next.releaseFormat = "episodic";
          next.hlsUrl = "";
          next.durationMinutes = "";
          next.introStartSeconds = "";
          next.introEndSeconds = "";
        } else if (nextType === "movie") {
          next.releaseFormat = "feature";
        } else if (!supportsReleaseFormatSwitch(nextType)) {
          next.releaseFormat = "feature";
        }
      }

      if (field === "releaseFormat" && value === "episodic") {
        next.hlsUrl = "";
        next.durationMinutes = "";
        next.introStartSeconds = "";
        next.introEndSeconds = "";
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
    setShowEditor(true);
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
    setShowEditor(true);
    requestAnimationFrame(() => document.getElementById("content-editor")?.scrollIntoView({ behavior: "smooth" }));
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
        ...(editingSlug ? {expectedUpdatedAt: contents.find(item=>item.id===contentDraft.id)?.updatedAt} : {}),
        title: contentDraft.title,
        slug: contentDraft.slug || slugifyContent(contentDraft.title),
        type: contentDraft.type,
        kind: draftIsEpisodic ? "series" : "movie",
        section: contentDraft.section,
        description: contentDraft.description,
        posterUrl: contentDraft.posterUrl,
        bannerUrl: contentDraft.bannerUrl,
        trailerUrl: contentDraft.trailerUrl || null,
        country: contentDraft.country,
        year: Number(contentDraft.year),
        status: contentDraft.status,
        ageRating: contentDraft.ageRating || null,
        durationMinutes: !draftIsEpisodic && contentDraft.durationMinutes ? Number(contentDraft.durationMinutes) : null,
        hlsUrl: !draftIsEpisodic ? contentDraft.hlsUrl || null : null,
        introStartSeconds: !draftIsEpisodic && contentDraft.introStartSeconds ? Number(contentDraft.introStartSeconds) : null,
        introEndSeconds: !draftIsEpisodic && contentDraft.introEndSeconds ? Number(contentDraft.introEndSeconds) : null,
        dubberId: contentDraft.dubberId || null,
        genreIds: contentDraft.genreIds,
        heroComment: contentDraft.heroComment || null,
        heroOrder: contentDraft.heroOrder ? Number(contentDraft.heroOrder) : null,
        hasKazakhSubtitles: contentDraft.hasKazakhSubtitles,
        isHero: contentDraft.isHero,
        isPremium: contentDraft.isPremium,
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

  async function removeContent(item: Content) {
    setDeletePending(null);
    setListError("");
    const response = await fetch(`/api/contents/${encodeURIComponent(item.slug)}`, {method:"DELETE"});
    if (!response.ok) {const result=await response.json();setListError(getApiError(result,"Жою мүмкін болмады."));return;}
    setContents(current=>current.filter(row=>row.id!==item.id));if(contentDraft.id===item.id)setShowEditor(false);
  }
  async function uploadMedia(file: File, field: "poster_url" | "banner_url") {
    if (file.size > 3*1024*1024) {setFormError("Сурет 3 МБ-тан аспауы керек.");return;}
    const current=contents.find(item=>item.id===contentDraft.id);if(!current?.updatedAt)return;
    setMediaBusy(true);setFormError(null);
    try {
      const response=await fetch("/api/admin/media",{method:"POST",headers:{"Content-Type":file.type,"X-Target-Id":current.id,"X-Media-Field":field,"X-Workflow":"false","X-Version":current.updatedAt,"X-Request-Id":crypto.randomUUID()},body:file});
      const result=await response.json();if(!response.ok)throw new Error(getApiError(result,"Сурет сақталмады."));
      const refreshed=await fetch(`/api/contents/${encodeURIComponent(current.slug)}?includeDrafts=true`,{cache:"no-store"});
      const record=await refreshed.json();if(!refreshed.ok||!record.data)throw new Error("Контентті жаңартыңыз.");
      upsertContent(record.data);setContentDraft(draft=>({...draft,[field === "poster_url" ? "posterUrl" : "bannerUrl"]:result.data.url}));
    }catch(error){setFormError(error instanceof Error?error.message:"Сурет сақталмады.");}finally{setMediaBusy(false);}
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

  async function saveSeason() {
    if (isSavingSeason) return;
    setIsSavingSeason(true);
    setEpisodeError(null);
    try {
      const response = await fetch(`/api/contents/${encodeURIComponent(activeSlug)}/seasons`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonNumber: Number(seasonNumber) })
      });
      const result = await response.json();
      if (!response.ok || !result.data) throw new Error(result.error?.message || "Маусымды сақтау мүмкін болмады.");
      const season = result.data as Season;
      const seasons = [...contentDraft.seasons, season].sort((a, b) => a.seasonNumber - b.seasonNumber);
      setContentDraft((current) => ({ ...current, seasons }));
      setContents((current) => current.map((item) => item.id === contentDraft.id ? { ...item, seasons } : item));
      setEpisodeDraft(createEmptyEpisode(1, season.id));
      setSeasonNumber("");
    } catch (error) {
      setEpisodeError(error instanceof Error ? error.message : "Маусымды сақтау мүмкін болмады.");
    } finally { setIsSavingSeason(false); }
  }

  async function saveEpisode() {
    if (!canSaveEpisode || isSavingEpisode) {
      return;
    }

    setIsSavingEpisode(true);
    setEpisodeError(null);

    try {
      const payload = {
        seasonId: episodeDraft.seasonId || null,
        episodeNumber: Number(episodeDraft.episodeNumber),
        title: episodeDraft.title || null,
        hlsUrl: episodeDraft.hlsUrl || null,
        thumbnailUrl: episodeDraft.thumbnailUrl || null,
        durationMinutes: episodeDraft.durationMinutes ? Number(episodeDraft.durationMinutes) : null,
        introStartSeconds: episodeDraft.introStartSeconds ? Number(episodeDraft.introStartSeconds) : null,
        introEndSeconds: episodeDraft.introEndSeconds ? Number(episodeDraft.introEndSeconds) : null,
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
      setEpisodeDraft(createEmptyEpisode(Math.max(nextEpisodeNumber, savedEpisode.episodeNumber + 1), episodeDraft.seasonId));
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
        setEpisodeDraft(createEmptyEpisode(nextEpisodeNumber, episodeDraft.seasonId));
      }
    } catch (error) {
      setEpisodeError(error instanceof Error ? error.message : "Серияны өшіру мүмкін болмады.");
    } finally {
      setIsSavingEpisode(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section id="content-editor" className={showEditor ? "glass-strong rounded-[34px] p-5 sm:p-7" : "hidden"}>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
              Контент
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.024em] text-white">
              {contentDraft.id ? "Контентті өңдеу" : "Жаңа контент қосу"}
            </h2>
          </div>
          <button
            className="glass-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold tracking-[0.01em] text-white"
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
            options={[{ label: "Фильм", value: "movie" }, { label: "Сериал", value: "series" }]}
          />
          <AdminSelect label="Бөлім" value={contentDraft.section} onChange={value => updateContentField("section", value as AdminContent["section"])} options={[{label:"Негізгі",value:"default"},{label:"Аниме",value:"anime"},{label:"Дорама",value:"dorama"}]} />
          <AdminSelect
            label="Статус"
            value={contentDraft.status}
            onChange={(value) => updateContentField("status", value as ContentStatus)}
            options={[
              { label: "Жалғасуда", value: "ongoing" },
              { label: "Аяқталған", value: "completed" },
              { label: "Жақында", value: "announced" }
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
          {!draftIsEpisodic ? (
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
            label="Дыбыстаушы"
            value={contentDraft.dubberId}
            onChange={(value) => updateContentField("dubberId", value)}
            options={[
              { label: "Таңдалмаған", value: "" },
              ...availableDubbers.map((dubber) => ({ label: dubber.name, value: dubber.id }))
            ]}
          />
          {!draftIsEpisodic ? (
            <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
              <div className="md:col-span-2">
                <AdminInput
                  label="HLS URL"
                  value={contentDraft.hlsUrl}
                  onChange={(value) => updateContentField("hlsUrl", value)}
                  placeholder="https://cdn.example.com/video/master.m3u8"
                />
              </div>
              <AdminInput
                label="Интро басталуы, сек"
                value={contentDraft.introStartSeconds}
                onChange={(value) => updateContentField("introStartSeconds", value)}
                placeholder="75"
              />
              <AdminInput
                label="Интро аяқталуы, сек"
                value={contentDraft.introEndSeconds}
                onChange={(value) => updateContentField("introEndSeconds", value)}
                placeholder="165"
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
            label="Қазақша субтитр"
            active={contentDraft.hasKazakhSubtitles}
            onClick={() => updateContentField("hasKazakhSubtitles", !contentDraft.hasKazakhSubtitles)}
          />
          <AdminToggle
            label="Premium"
            active={contentDraft.isPremium}
            onClick={() => updateContentField("isPremium", !contentDraft.isPremium)}
          />
          <AdminToggle
            label="Жарияланған"
            active={contentDraft.isPublished}
            onClick={() => updateContentField("isPublished", !contentDraft.isPublished)}
          />
        </div>

        <div className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                Басты баннер
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-[-0.014em] text-white">Басты слайд</h3>
            </div>
            <AdminToggle
              label={contentDraft.isHero ? "Баннерге қосылған" : "Баннерге қосу"}
              active={contentDraft.isHero}
              onClick={() => updateContentField("isHero", !contentDraft.isHero)}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
            <AdminInput
              label="Реті"
              value={contentDraft.heroOrder}
              onChange={(value) => updateContentField("heroOrder", value)}
              placeholder="0"
            />
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Баннердегі қысқа мәтін</span>
              <textarea
                value={contentDraft.heroComment}
                onChange={(event) => updateContentField("heroComment", event.target.value)}
                className="mt-2 min-h-20 w-full resize-none rounded-[24px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-[rgba(217,183,111,0.45)] focus:bg-white/[0.08]"
                placeholder="Көрерменге арналған қысқа мәтін..."
              />
            </label>
          </div>
        </div>

        {contentDraft.isPublished && !draftIsEpisodic && !contentDraft.hlsUrl.trim() && (
          <p className="mt-4 text-sm text-amber-300">Фильм видеосы дайын емес. Дайын видеоны тексеріңіз.</p>
        )}
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

        {contentDraft.id && <div className="mt-4 flex flex-wrap gap-4" aria-label="Медиа">
          {(["poster_url", "banner_url"] as const).map(field=><label key={field} className="glass-button cursor-pointer rounded-xl p-3 text-sm">{field === "poster_url" ? "Постер жүктеу / ауыстыру" : "Баннер жүктеу / ауыстыру"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={mediaBusy} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void uploadMedia(file,field);}} /></label>)}
          <span className="text-sm text-zinc-400">{mediaBusy ? "Сурет сақталуда…" : "JPG · PNG · WEBP"}</span>
        </div>}
        {draftIsEpisodic ? (
          <section className="mt-8 border-t border-white/10 pt-7">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
                  Сериялар
                </p>
                <h3 className="mt-2 text-xl font-bold tracking-[-0.014em] text-white">Сериялар</h3>
              </div>
              <button
                className="glass-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold tracking-[0.01em] text-white"
                onClick={() => setEpisodeDraft(createEmptyEpisode(nextEpisodeNumber, episodeDraft.seasonId))}
                type="button"
              >
                <Plus className="h-4 w-4" />
                Серия қосу
              </button>
            </div>

            {contentDraft.id ? (
              <div className="mb-4 flex items-end gap-3">
                <AdminInput label="Жаңа маусым нөмірі" value={seasonNumber} onChange={setSeasonNumber} placeholder="2" />
                <button type="button" className="glass-button rounded-xl p-3 text-sm text-white" disabled={isSavingSeason || !seasonNumber} onClick={() => void saveSeason()}>
                  {isSavingSeason ? "Сақталуда..." : "Маусым қосу"}
                </button>
              </div>
            ) : null}
            {!contentDraft.id ? (
              <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-zinc-400">
                Алдымен дорама, сериал немесе аниме контентін сақтаңыз. Содан кейін серияларды осы жерде қосасыз.
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid gap-3">
                  {contentDraft.episodes.length > 0 ? (
                    contentDraft.episodes.map((episode) => (
                      <article key={episode.id} className="glass flex flex-col gap-3 rounded-[24px] p-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-semibold text-white">
                            {episode.seasonNumber ? `${episode.seasonNumber}-маусым · ` : "Маусымы белгісіз · "}{episode.episodeNumber}-серия
                            {episode.title ? ` — ${episode.title}` : ""}
                          </h4>
                          <p className="mt-1 truncate text-xs text-zinc-500">
                            /{contentDraft.slug}?episode={episode.slug}#player
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill active={episode.isPublished} label={episode.isPublished ? "Жарияланған" : "Жоба"} />
                          <button
                            className="glass-button flex h-10 w-10 items-center justify-center rounded-full text-white"
                            onClick={() => setEpisodeDraft(toEpisodeDraft(episode))}
                            aria-label="Серияны өңдеу"
                            type="button"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            className="glass-button flex h-10 w-10 items-center justify-center rounded-full text-red-200"
                            onClick={() => void deleteEpisode(episode)}
                            aria-label="Серияны өшіру"
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
                    <label className="text-sm text-zinc-300">
                      Маусым
                      <select className="mt-2 w-full rounded-xl bg-zinc-900 p-3" value={episodeDraft.seasonId}
                        onChange={(event) => {
                          const seasonId = event.target.value;
                          const items = contentDraft.episodes.filter((item) => (item.seasonId ?? "") === seasonId);
                          setEpisodeDraft((current) => ({ ...current, seasonId,
                            episodeNumber: current.id ? current.episodeNumber : String(Math.max(0, ...items.map((item) => item.episodeNumber)) + 1) }));
                        }}>
                        <option value="">Маусымы белгісіз</option>
                        {contentDraft.seasons.map((season) => <option key={season.id} value={season.id}>{season.seasonNumber}-маусым{season.title ? ` — ${season.title}` : ""}</option>)}
                      </select>
                    </label>
                    <AdminInput
                      label="Серия нөмірі"
                      value={episodeDraft.episodeNumber}
                      onChange={(value) => setEpisodeDraft((current) => ({ ...current, episodeNumber: value }))}
                      placeholder="1"
                    />
                    <AdminInput
                      label="Серия атауы"
                      value={episodeDraft.title}
                      onChange={(value) => setEpisodeDraft((current) => ({ ...current, title: value }))}
                      placeholder="Қалауыңызша"
                    />
                    <AdminInput
                      label="HLS URL"
                      value={episodeDraft.hlsUrl}
                      onChange={(value) => setEpisodeDraft((current) => ({ ...current, hlsUrl: value }))}
                      placeholder="https://cdn.example.com/dorama/1/master.m3u8"
                    />
                    <AdminInput
                      label="Кадр URL"
                      value={episodeDraft.thumbnailUrl}
                      onChange={(value) => setEpisodeDraft((current) => ({ ...current, thumbnailUrl: value }))}
                      placeholder="Қалауыңызша"
                    />
                    <AdminInput
                      label="Ұзақтығы, минут"
                      value={episodeDraft.durationMinutes}
                      onChange={(value) => setEpisodeDraft((current) => ({ ...current, durationMinutes: value }))}
                      placeholder="64"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <AdminInput
                        label="Интро басталуы, сек"
                        value={episodeDraft.introStartSeconds}
                        onChange={(value) => setEpisodeDraft((current) => ({ ...current, introStartSeconds: value }))}
                        placeholder="75"
                      />
                      <AdminInput
                        label="Интро аяқталуы, сек"
                        value={episodeDraft.introEndSeconds}
                        onChange={(value) => setEpisodeDraft((current) => ({ ...current, introEndSeconds: value }))}
                        placeholder="165"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <AdminToggle
                      label={episodeDraft.isPublished ? "Жарияланған" : "Жоба"}
                      active={episodeDraft.isPublished}
                      onClick={() => setEpisodeDraft((current) => ({ ...current, isPublished: !current.isPublished }))}
                    />
                  </div>
                  {episodeDraft.isPublished && !episodeDraft.hlsUrl.trim() && (
                    <p className="text-sm text-amber-300">Эпизод видеосы дайын емес. Дайын видеоны тексеріңіз.</p>
                  )}
                  <button
                    className="hero-watch-button mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!canSaveEpisode || isSavingEpisode}
                    onClick={saveEpisode}
                    type="button"
                  >
                    <Save className="h-4 w-4" />
                    {isSavingEpisode ? "Сақталып жатыр..." : "Серияны сақтау"}
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

      <aside className={showEditor ? "space-y-4" : "hidden"}>
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
            {contentDraft.hasKazakhSubtitles ? <StatusPill active label="Қазақша субтитр" /> : null}
            {contentDraft.isHero ? <StatusPill active label={`Баннер ${contentDraft.heroOrder || "0"}`} /> : null}
          </div>
          <h3 className="mt-3 truncate text-lg font-semibold text-white">{contentDraft.title || "Контент атауы"}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {contentDraft.year || "Жыл"} · {contentDraft.country || "Ел"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {draftIsEpisodic
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
              <p className="mt-1 text-xs text-zinc-500">{availableDubbers.length} дыбыстаушы</p>
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
              <p className="py-3 text-sm text-zinc-500">Әзірге дыбыстаушы жоқ</p>
            )}
          </div>
        </section>

        <section className="glass rounded-[30px] p-5">
          <h3 className="mb-4 font-semibold text-white">Құрылым ережелері</h3>
          {[
            "Фильм әрдайым толық метражды HLS URL арқылы сақталады",
            "Мультфильм де толық метражды контент ретінде сақталады",
            "Қазақша субтитр белгісі каталогтағы бөлек бөлімге шығарады",
            "Аниме және дорама толық метражды немесе сериялы форматта сақтала алады",
            "Сериал сериялары бөлек episodes кестесінде сақталады",
            "Серия slug бос болса, episode number арқылы толады",
            "Жария беттер тек жарияланған контент пен жарияланған серияларды көрсетеді",
            "Толық метражды аниме/дорама бірден көру бетіне, сериялы формат серия тізіміне өтеді"
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 border-t border-white/10 py-3 first:border-t-0 first:pt-0">
              <Check className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-sm text-zinc-300">{item}</span>
            </div>
          ))}
        </section>
      </aside>

      <section className="order-first xl:col-span-2">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
              Контент
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.024em] text-white">Контент тізімі</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {typeFilterOptions.map((option) => (
              <FilterButton
                key={option.value}
                active={typeFilter === option.value}
                label={option.label}
                onClick={() => {setTypeFilter(option.value);setPage(0);}}
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
              onClick={() => {setStatusFilter(option.value);setPage(0);}}
            />
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-3">
          <input aria-label="Контент іздеу" placeholder="Атауын іздеу" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} className="rounded-xl bg-zinc-900 p-3" />
          <select aria-label="Жария күйі" value={publication} onChange={e=>{setPublication(e.target.value);setPage(0);}} className="rounded-xl bg-zinc-900 p-3"><option value="all">Бәрі</option><option value="published">Жарияланған</option><option value="draft">Жоба / жарияланбаған</option><option value="ready">Дайын / тексеру</option></select>
          <button className="glass-button rounded-xl px-4" onClick={startNewContent}>Жаңа контент</button>
        </div>
        {deletePending && <div role="dialog" aria-label="Контентті жою" className="mb-3 flex flex-wrap gap-3 rounded-xl border border-red-400/30 p-4"><p>«{deletePending.title}» контентін жою керек пе? Тек қолданылмаған жоба жойылады.</p><button onClick={()=>void removeContent(deletePending)}>Иә, жою</button><button onClick={()=>setDeletePending(null)}>Бас тарту</button></div>}
        {listError && <p role="alert" className="mb-3 text-red-300">{listError}</p>}
        <div className="grid gap-3">
          {filteredContents.slice(page * 10, page * 10 + 10).map((item) => {
            const itemIsEpisodic = isEpisodicContent(item);

            return (
              <article
                key={item.id}
                className="glass flex flex-wrap items-center gap-3 rounded-2xl p-3 sm:flex-nowrap"
              >
                <img
                  src={item.posterUrl || "/movie-poster-fallback.svg"}
                  alt={item.title}
                  className="h-16 w-12 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-zinc-400">{contentTypeLabels[item.type]} · {getReleaseFormat(item) === "episodic" ? "Сериал" : "Фильм"} · {item.isPublished ? "Жарияланған" : readyContentIds.includes(item.id) ? "Дайын · тексеруді күтеді" : "Жоба"}</p>
                  <h3 className="truncate font-semibold text-white">{item.title}</h3>
                  <p className="mt-1 truncate text-sm text-zinc-500">
                    {item.year} · {item.country || "Ел жоқ"} · {item.dubber?.name ?? "Дыбыстаушы жоқ"}
                  </p>
                  <p className="mt-1 truncate text-xs text-zinc-600">
                    {item.genres.map((genre) => genre.name).join(", ")}
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:max-w-[55%]">
                  <button
                    className="glass-button inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-white"
                    onClick={() => startEditContent(item)}
                    type="button"
                  >
                    <Pencil className="h-4 w-4" />
                    Өңдеу
                  </button>
                  <a className="glass-button rounded-full px-3 py-2 text-sm" href={`/${item.slug}`} target="_blank" rel="noreferrer">Ашу</a>
                  {!item.isPublished && <a className="glass-button rounded-full px-3 py-2 text-sm" href="https://t.me/hdqaz_bot" title="Telegram → Іздеу → осы контент → Видео қосу" target="_blank" rel="noreferrer">Видео</a>}
                  <button className="glass-button rounded-full px-3 py-2 text-sm" onClick={() => {startEditContent(item);setContentDraft(current=>({...current,isPublished:!item.isPublished}));}}> {item.isPublished ? "Жарияламау / Archive" : "Жариялау"}</button>
                  {!item.isPublished && <button className="glass-button rounded-full px-3 py-2 text-sm" onClick={() => setDeletePending(item)}>Жою</button>}

                </div>
              </article>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-sm"><button disabled={!page} onClick={()=>setPage(p=>p-1)}>Алдыңғы</button><span>{page+1}</span><button disabled={(page+1)*10>=filteredContents.length} onClick={()=>setPage(p=>p+1)}>Келесі</button></div>
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
