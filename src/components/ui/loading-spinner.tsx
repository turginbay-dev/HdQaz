import { Loader2 } from "lucide-react";

export function LoadingSpinner({ label = "Жүктелуде…" }: { label?: string }) {
  return <span className="loading-indicator" role="status"><Loader2 className="loading-spinner" aria-hidden="true" /><span>{label}</span></span>;
}
