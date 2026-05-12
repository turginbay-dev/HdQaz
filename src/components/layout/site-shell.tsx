import { Suspense } from "react";
import { DesktopNav } from "@/components/layout/desktop-nav";
import { Footer } from "@/components/layout/footer";
import { MobileNav } from "@/components/layout/mobile-nav";

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
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}
