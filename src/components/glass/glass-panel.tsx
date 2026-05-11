import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  strong?: boolean;
};

export function GlassPanel({ className, strong = false, ...props }: GlassPanelProps) {
  return (
    <div
      className={cn(strong ? "glass-strong" : "glass", "rounded-[28px]", className)}
      {...props}
    />
  );
}
