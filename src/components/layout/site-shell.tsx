import { Suspense } from "react";
import { DesktopNav } from "@/components/layout/desktop-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteLogo } from "@/components/layout/site-logo";

type SiteShellProps = {
  children: React.ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  return (
    <>
      <Suspense fallback={null}>
        <DesktopNav />
        <MobileNav />
      </Suspense>
      {children}
      <footer className="relative overflow-hidden border-t border-white/10 px-4 py-12 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(217,183,111,0.12),transparent_42%)]" />
        <div className="relative mx-auto max-w-7xl">
          <SiteLogo variant="footer" className="mx-auto" />
          <p className="mt-2 text-sm text-zinc-500">
            Қазақша дыбыстама және жаңа релиздер қазақша субтитрмен.
          </p>
        </div>
      </footer>
    </>
  );
}
