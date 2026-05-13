import { Suspense } from "react";
import { DesktopNav } from "@/components/layout/desktop-nav";
import { Footer } from "@/components/layout/footer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { getViewerContext } from "@/features/users/session";

type SiteShellProps = {
  children: React.ReactNode;
};

export async function SiteShell({ children }: SiteShellProps) {
  const viewer = await getViewerContext();

  return (
    <>
      <Suspense fallback={null}>
        <DesktopNav isPremium={viewer.premium.isPremium} />
        <MobileNav isPremium={viewer.premium.isPremium} />
      </Suspense>
      {children}
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}
