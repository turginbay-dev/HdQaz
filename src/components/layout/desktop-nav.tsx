"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Crown, Search, User } from "lucide-react";
import { mainNavigation } from "@/lib/navigation";
import { cn } from "@/lib/cn";

const searchHints = ["Interstellar", "Қазақша дыбыстама", "Dune: Part Two", "Жаңа релиздер"];

export function DesktopNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 32);
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setHintIndex((current) => (current + 1) % searchHints.length);
    }, 2200);

    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="fixed left-0 right-0 top-5 z-50 hidden justify-center px-6 lg:flex">
      <motion.nav
        className={cn(
          "flex h-16 items-center gap-2 rounded-full border px-3 transition-colors duration-300",
          scrolled
            ? "border-white/[0.16] bg-black/[0.58] shadow-[0_22px_80px_rgba(0,0,0,0.5)] backdrop-blur-3xl"
            : "border-white/[0.12] bg-white/[0.055] shadow-[0_18px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
        )}
        initial={{ opacity: 0, y: -18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link
          href="/"
          className="rounded-full px-4 py-2 text-base font-semibold tracking-tight text-white"
        >
          HdQaz
        </Link>

        <div className="flex items-center">
          {mainNavigation.map((item) => {
            const itemPath = item.href.split("?")[0];
            const itemParams = new URLSearchParams(item.href.split("?")[1]);
            const itemCatalog = itemParams.get("catalog");
            const itemFilter = itemParams.get("filter");
            const currentCatalog = searchParams.get("catalog");
            const currentFilter = searchParams.get("filter");
            const currentGenre = searchParams.get("genre");
            const active =
              pathname === itemPath &&
              (itemCatalog
                ? currentCatalog === itemCatalog
                : itemFilter
                  ? currentFilter === itemFilter
                  : itemPath === "/catalog"
                    ? !currentCatalog && !currentFilter && !currentGenre
                    : true);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative rounded-full px-3.5 py-2 text-sm font-medium text-zinc-300 transition hover:text-white"
              >
                {active && (
                  <motion.span
                    layoutId="desktop-active-nav"
                    className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.12]"
                    transition={{ type: "spring", stiffness: 360, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="ml-1 flex items-center gap-2 border-l border-white/10 pl-3">
          <motion.div
            className="relative"
            animate={{ width: searchOpen || focused ? 238 : 44 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onHoverStart={() => setSearchOpen(true)}
            onHoverEnd={() => {
              if (!focused) {
                setSearchOpen(false);
              }
            }}
          >
            <div
              className={cn(
                "glass-button relative flex h-11 w-full items-center rounded-full text-white",
                searchOpen || focused ? "justify-start gap-2 px-4" : "justify-center"
              )}
            >
              <Search className="h-4 w-4 shrink-0" />
              {(searchOpen || focused) && (
                <>
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-transparent"
                    aria-label="Кино іздеу"
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                      setFocused(false);
                      setSearchOpen(false);
                    }}
                  />
                  {!focused && (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={searchHints[hintIndex]}
                        className="pointer-events-none absolute left-10 right-4 truncate text-sm text-zinc-400"
                        initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
                        transition={{ duration: 0.24 }}
                      >
                        {searchHints[hintIndex]}
                      </motion.span>
                    </AnimatePresence>
                  )}
                </>
              )}
            </div>
          </motion.div>

          <Link
            href="/premium"
            className="glass-button flex h-11 items-center gap-2 rounded-full border-[rgba(217,183,111,0.32)] px-4 text-sm font-semibold text-white shadow-[0_0_34px_rgba(217,183,111,0.1)] hover:shadow-[0_0_46px_rgba(217,183,111,0.2)]"
          >
            <Crown className="h-4 w-4 text-[var(--accent)]" />
            Premium
          </Link>

          <Link
            href="/profile"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white text-black shadow-[0_14px_45px_rgba(255,255,255,0.16)] transition hover:scale-105"
            aria-label="Профиль"
          >
            <User className="h-4 w-4" />
          </Link>
        </div>
      </motion.nav>
    </header>
  );
}
