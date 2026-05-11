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
    description: "Қазақша субтитрмен немесе AI субтитрмен"
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
