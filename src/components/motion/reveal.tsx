import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function Reveal({ children, className, delay: _delay = 0 }: RevealProps) {
  return <div className={cn(className)}>{children}</div>;
}
