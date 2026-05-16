import { LogoMark } from "@/components/layout/site-logo";

export function AppLoadingScreen() {
  return (
    <div className="app-loading-screen" role="status" aria-label="HdQaz жүктелуде">
      <div className="app-loading-mark">
        <LogoMark className="h-20 w-28 p-1.5" priority sizes="112px" />
      </div>
      <div className="app-loading-bar" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}
