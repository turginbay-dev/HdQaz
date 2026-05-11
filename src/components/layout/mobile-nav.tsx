"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Menu, Search, User, X } from "lucide-react";
import { SiteLogo } from "@/components/layout/site-logo";
import { mainNavigation } from "@/lib/navigation";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-4 lg:hidden">
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}>
          <SiteLogo variant="mobile" priority />
        </motion.div>
        <motion.div
          className="flex items-center gap-2"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <button
            className="glass-button flex h-12 w-12 items-center justify-center rounded-full text-white"
            aria-label="Іздеу"
          >
            <Search className="h-5 w-5" />
          </button>
          <button
            className="glass-button flex h-12 w-12 items-center justify-center rounded-full text-white"
            aria-label="Мәзір"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </motion.div>
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.button
              className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-md lg:hidden"
              aria-label="Мәзірді жабу"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="glass-strong fixed right-3 top-3 z-[80] flex h-[calc(100vh-24px)] w-[min(86vw,380px)] flex-col rounded-[30px] p-4 lg:hidden"
              initial={{ x: 380, opacity: 0, scale: 0.98 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 380, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 280, damping: 30 }}
            >
              <div className="flex items-center justify-between">
                <SiteLogo variant="drawer" onClick={() => setOpen(false)} />
                <button
                  className="glass-button flex h-10 w-10 items-center justify-center rounded-full text-white"
                  aria-label="Жабу"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-8 flex flex-col gap-2">
                {mainNavigation.map((item, index) => {
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
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 * index }}
                    >
                      <Link
                        href={item.href}
                        className={
                          active
                            ? "flex items-center justify-between rounded-2xl border border-white/[0.12] bg-white/[0.12] px-4 py-3 text-base font-semibold text-white"
                            : "flex items-center justify-between rounded-2xl px-4 py-3 text-base font-medium text-zinc-100 transition hover:bg-white/10"
                        }
                        onClick={() => setOpen(false)}
                      >
                        {item.label}
                        {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                      </Link>
                    </motion.div>
                  );
                })}
                <motion.div
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * mainNavigation.length }}
                >
                  <Link
                    href="/profile"
                    className={
                      pathname === "/profile"
                        ? "flex items-center justify-between rounded-2xl border border-white/[0.12] bg-white/[0.12] px-4 py-3 text-base font-semibold text-white"
                        : "flex items-center justify-between rounded-2xl px-4 py-3 text-base font-medium text-zinc-100 transition hover:bg-white/10"
                    }
                    onClick={() => setOpen(false)}
                  >
                    <span className="inline-flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Профиль
                    </span>
                    {pathname === "/profile" && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                  </Link>
                </motion.div>
              </div>

              <Link
                href="/premium"
                className="cinema-sweep mt-auto rounded-[26px] border border-[rgba(217,183,111,0.25)] bg-[rgba(217,183,111,0.12)] p-4"
                onClick={() => setOpen(false)}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-black">
                    <Crown className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">HdQaz Premium</p>
                    <p className="mt-1 text-sm leading-5 text-zinc-400">1080p және Premium мүмкіндіктер</p>
                  </div>
                </div>
              </Link>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
