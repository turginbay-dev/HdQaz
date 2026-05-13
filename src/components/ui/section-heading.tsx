import type { ReactNode } from "react";

type SectionHeadingProps = {
  title: string;
  action?: ReactNode;
};

export function SectionHeading({ title, action }: SectionHeadingProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-xl font-bold tracking-[-0.02em] text-white sm:text-2xl">{title}</h2>
      {action}
    </div>
  );
}
