import { Suspense } from "react";
import { DesktopNav } from "@/components/layout/desktop-nav";
import { Footer } from "@/components/layout/footer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavigationLoadingOverlay } from "@/components/layout/navigation-loading-overlay";
import { getViewerContext } from "@/features/users/session";

type SiteShellProps = {
  children: React.ReactNode;
};

export async function SiteShell({ children }: SiteShellProps) {
  const viewer = await getViewerContext();

  return (
    <>
      <Suspense fallback={null}>
        <NavigationLoadingOverlay />
        <DesktopNav
          avatarUrl={viewer.profile?.avatarUrl}
          displayName={viewer.profile?.displayName}
          isPremium={viewer.premium.isPremium}
        />
        <MobileNav
          avatarUrl={viewer.profile?.avatarUrl}
          displayName={viewer.profile?.displayName}
          isPremium={viewer.premium.isPremium}
        />
      </Suspense>
      {children}
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}
