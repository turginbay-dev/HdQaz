"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AtSign, ExternalLink, Mail, Send, UsersRound } from "lucide-react";
import { LogoMark } from "@/components/layout/site-logo";
import type { Dubber } from "@/types/content";

type FooterLinkItem = {
  label: string;
  href: string;
};

type FooterDubber = Pick<Dubber, "id" | "logoUrl" | "name" | "telegramUrl" | "vkUrl">;

const footerNavigation: FooterLinkItem[] = [
  { label: "Басты бет", href: "/" },
  { label: "Каталог", href: "/catalog" },
  { label: "Дорамалар", href: "/catalog?q=Dorama" },
  { label: "Аниме", href: "/catalog?q=Anime" },
  { label: "Байланыс", href: "mailto:hello@hdqaz.com" }
];

const supportLinks: FooterLinkItem[] = [
  { label: "Авторлық құқық", href: "mailto:copyright@hdqaz.com" },
  { label: "Байланыс", href: "mailto:hello@hdqaz.com" },
  { label: "Қолдау", href: "mailto:support@hdqaz.com" }
];

const socialLinks = [
  { label: "Telegram", href: "https://t.me/hdqaz", icon: Send },
  { label: "Instagram", href: "https://instagram.com/hdqaz", icon: AtSign },
  { label: "Email", href: "mailto:hello@hdqaz.com", icon: Mail }
];

export function Footer() {
  const pathname = usePathname();
  const [dubbers, setDubbers] = useState<FooterDubber[]>([]);
  const [loadedDubbers, setLoadedDubbers] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loadedDubbers || !pathname || pathname.startsWith("/admin")) {
      return;
    }

    let cancelled = false;

    async function loadDubbers() {
      try {
        const response = await fetch("/api/dubbers");

        if (!response.ok) {
          return;
        }

        const payload = await response.json() as { dubbers?: FooterDubber[] };

        if (!cancelled) {
          setDubbers(payload.dubbers ?? []);
        }
      } finally {
        if (!cancelled) {
          setLoadedDubbers(true);
        }
      }
    }

    void loadDubbers();

    return () => {
      cancelled = true;
    };
  }, [loadedDubbers, mounted, pathname]);

  if (!mounted || !pathname || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <footer className="relative overflow-hidden border-t border-white/[0.08] px-4 pb-8 pt-10 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_0%,rgba(143,183,255,0.1),transparent_34%),radial-gradient(ellipse_at_78%_0%,rgba(217,183,111,0.12),transparent_36%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="relative mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.95fr)_minmax(180px,0.65fr)_minmax(170px,0.55fr)]">
          <div className="max-w-md">
            <Link
              href="/"
              className="inline-flex items-center rounded-[24px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
              aria-label="HdQaz басты бет"
            >
              <LogoMark className="h-14 w-[84px] p-1.5" sizes="84px" />
            </Link>
            <p className="mt-4 text-sm font-medium leading-6 tracking-[0.004em] text-zinc-400">
              Қазақша фильмдер, дорамалар, аниме және сериалдарды ыңғайлы көруге арналған платформа.
            </p>
          </div>

          <section aria-labelledby="footer-dubbers">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.06] text-[var(--accent)]">
                <UsersRound className="h-4 w-4" />
              </span>
              <h2 id="footer-dubbers" className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-300">
                Дыбыстау серіктестері
              </h2>
            </div>
            {dubbers.length > 0 ? (
              <div className="hide-scrollbar grid max-h-44 gap-2 overflow-y-auto pr-1">
                {dubbers.map((dubber) => (
                  <DubberFooterItem key={dubber.id} dubber={dubber} />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-white/[0.1] bg-white/[0.045] px-4 py-3 text-sm text-zinc-500">
                Серіктестер жақында қосылады.
              </p>
            )}
          </section>

          <FooterLinkGroup id="footer-navigation" title="Навигация" links={footerNavigation} />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
            <FooterLinkGroup id="footer-support" title="Құқық және көмек" links={supportLinks} />
            <section aria-labelledby="footer-social">
              <h2 id="footer-social" className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-300">
                Әлеуметтік
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {socialLinks.map((item) => {
                  const Icon = item.icon;

                  return (
                    <FooterAnchor
                      key={item.label}
                      href={item.href}
                      className="glass-button inline-flex h-10 w-10 items-center justify-center rounded-full text-zinc-200"
                      ariaLabel={item.label}
                    >
                      <Icon className="h-4 w-4" />
                    </FooterAnchor>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <div className="relative mx-auto mt-8 flex w-full max-w-7xl flex-col gap-2 border-t border-white/[0.08] pt-5 text-xs leading-5 text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 HdQaz. Барлық құқықтар қорғалған.</p>
          <p className="max-w-2xl sm:text-right">
            Кейбір аудармалар мен дыбыстаулар серіктес командалардың еңбегімен ұсынылады.
          </p>
        </div>
    </footer>
  );
}

function FooterLinkGroup({ id, links, title }: { id: string; links: FooterLinkItem[]; title: string }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-300">
        {title}
      </h2>
      <nav className="mt-3 grid gap-2" aria-label={title}>
        {links.map((item) => (
          <FooterAnchor
            key={`${item.label}-${item.href}`}
            href={item.href}
            className="text-sm text-zinc-500 transition hover:text-white"
          >
            {item.label}
          </FooterAnchor>
        ))}
      </nav>
    </section>
  );
}

function DubberFooterItem({ dubber }: { dubber: FooterDubber }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.1] bg-white/[0.055] p-2.5">
      {dubber.logoUrl ? (
        <img
          src={dubber.logoUrl}
          alt={dubber.name}
          className="h-10 w-10 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(217,183,111,0.14)] text-sm font-semibold text-[var(--accent)]">
          {dubber.name.slice(0, 1)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{dubber.name}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {dubber.telegramUrl ? <DubberSocialLink href={dubber.telegramUrl} label="Telegram" /> : null}
        {dubber.vkUrl ? <DubberSocialLink href={dubber.vkUrl} label="VK" /> : null}
      </div>
    </div>
  );
}

function DubberSocialLink({ href, label }: FooterLinkItem) {
  return (
    <FooterAnchor
      href={href}
      className="rounded-full border border-white/[0.12] bg-black/20 px-2.5 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-white/25 hover:text-white"
    >
      {label}
      <ExternalLink className="ml-1 inline h-3 w-3" />
    </FooterAnchor>
  );
}

function FooterAnchor({
  ariaLabel,
  children,
  className,
  href
}: {
  ariaLabel?: string;
  children: React.ReactNode;
  className?: string;
  href: string;
}) {
  const external = href.startsWith("http");

  if (external || href.startsWith("mailto:")) {
    return (
      <a
        href={href}
        className={className}
        aria-label={ariaLabel}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
