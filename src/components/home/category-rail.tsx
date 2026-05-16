"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { movieCatalogs, movieGenres } from "@/lib/movie-taxonomy";

const highlightedCatalogs = ["premium", "full-hd", "kazakh-dubbed", "kazakh-subtitles", "new-releases"];
const highlightedGenres = ["Анимация", "Фантастика", "Драма", "Экшн"];

export function CategoryRail() {
  const categoryChips = [
    ...movieCatalogs
      .filter((catalog) => highlightedCatalogs.includes(catalog.id))
      .map((catalog) => ({
        key: `catalog-${catalog.id}`,
        label: catalog.label,
        href: {
          pathname: "/catalog",
          query: { catalog: catalog.id }
        },
        solid: catalog.id === "premium"
      })),
    ...movieGenres
      .filter((genre) => highlightedGenres.includes(genre))
      .map((genre) => ({
        key: `genre-${genre}`,
        label: genre,
        href: {
          pathname: "/catalog",
          query: { genre }
        },
        solid: false
      }))
  ];

  return (
    <div className="cinema-mask performance-rail hide-scrollbar -mx-4 flex snap-x gap-2 overflow-x-auto px-4 py-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {categoryChips.map((category) => (
        <motion.div
          key={category.key}
          className="snap-start"
          whileHover={{ y: -2, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          <Link
            href={category.href}
            className={
              category.solid
                ? "relative block overflow-hidden rounded-full bg-white px-4 py-2.5 text-sm font-bold tracking-[0.012em] text-black shadow-[0_14px_42px_rgba(255,255,255,0.18)]"
                : "glass-button block rounded-full px-4 py-2.5 text-sm font-semibold tracking-[0.012em] text-white"
            }
          >
            {category.solid && (
              <motion.span
                layoutId="category-active"
                className="absolute inset-0 rounded-full bg-white"
                transition={{ type: "spring", stiffness: 360, damping: 30 }}
              />
            )}
            <span className="relative z-10 whitespace-nowrap">{category.label}</span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
