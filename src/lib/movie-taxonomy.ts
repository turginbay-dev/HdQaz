export const movieGenres = [
  "Фантастика",
  "Драма",
  "Шытырман",
  "Биография",
  "Анимация",
  "Отбасы",
  "Экшн",
  "Комедия",
  "Романтика",
  "Қорқынышты"
] as const;

export type MovieGenre = (typeof movieGenres)[number];

export const movieLanguages = [
  {
    id: "kk",
    label: "Қазақ тілі",
    shortLabel: "Қазақша"
  },
  {
    id: "en",
    label: "Ағылшын тілі",
    shortLabel: "Ағылшынша"
  },
  {
    id: "ru",
    label: "Орыс тілі",
    shortLabel: "Орысша"
  }
] as const;

export type MovieLanguageId = (typeof movieLanguages)[number]["id"];

export function isMovieLanguageId(value: string): value is MovieLanguageId {
  return movieLanguages.some((language) => language.id === value);
}

export function normalizeMovieLanguages(languages?: readonly string[] | null): MovieLanguageId[] {
  const normalized = (languages ?? []).filter(isMovieLanguageId);

  return normalized.length > 0 ? normalized : ["kk"];
}

export function getMovieLanguageLabel(id: string, variant: "long" | "short" = "long") {
  const language = movieLanguages.find((item) => item.id === id);

  if (!language) {
    return id;
  }

  return variant === "short" ? language.shortLabel : language.label;
}

export function formatMovieLanguages(
  languages?: readonly string[] | null,
  variant: "long" | "short" = "long"
) {
  return normalizeMovieLanguages(languages).map((language) => getMovieLanguageLabel(language, variant)).join(" · ");
}

export const movieCatalogs = [
  {
    id: "premium",
    label: "Premium",
    description: "Ақылы жазылымға арналған таңдаулы контент"
  },
  {
    id: "full-hd",
    label: "1080p",
    description: "Full HD сапада көруге дайын"
  },
  {
    id: "kazakh-dubbed",
    label: "Қазақша дыбыстама",
    description: "Қазақша дыбысталған кинолар"
  },
  {
    id: "kazakh-subtitles",
    label: "Қазақша субтитр",
    description: "Қазақша субтитрі бар кинолар"
  },
  {
    id: "new-releases",
    label: "Жаңа релиздер",
    description: "Жақында қосылған фильмдер"
  },
  {
    id: "top-10",
    label: "Top 10",
    description: "Аптаның ең көп қаралған таңдауы"
  },
  {
    id: "ai-picks",
    label: "AI ұсыныстар",
    description: "Көңіл-күйге қарай ұсынылатын кинолар"
  }
] as const;

export type MovieCatalogId = (typeof movieCatalogs)[number]["id"];

export function getCatalogLabel(id: string) {
  return movieCatalogs.find((catalog) => catalog.id === id)?.label ?? id;
}
