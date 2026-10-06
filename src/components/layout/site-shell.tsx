import { Suspense } from "react";
import { ViewerHeader } from "@/components/layout/viewer-header";
import { Footer } from "@/components/layout/footer";
import { LanguagePreferenceSync } from "@/components/layout/language-switcher";
import { getViewerContext } from "@/features/users/session";

type SiteShellProps = {
  children: React.ReactNode;
};

export async function SiteShell({ children }: SiteShellProps) {
  const viewer = await getViewerContext();

  return (
    <>
      <Suspense fallback={null}>
        <LanguagePreferenceSync />
        <ViewerHeader avatarUrl={viewer.profile?.avatarUrl} displayName={viewer.profile?.displayName} isAdmin={viewer.isAdmin} />
      </Suspense>
      {children}
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </>
  );
}
