import type { LegalDocument } from "@/content/legal-documents";

type LegalDocumentPageProps = {
  document: LegalDocument;
};

const sectionHeadingPattern = /^\d+\.\s/;
const numberedParagraphPattern = /^\d+\.\d+(?:\.\d+)?\./;
const contactLabelPattern = /^[A-Za-z]+:$/;

export function LegalDocumentPage({ document }: LegalDocumentPageProps) {
  return (
    <main className="ambient-page relative min-h-screen overflow-hidden px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_8%,rgba(217,183,111,0.14),transparent_34%),radial-gradient(ellipse_at_12%_22%,rgba(143,183,255,0.11),transparent_30%)]" />
      <div className="cinematic-fog" />

      <article className="relative mx-auto w-full max-w-4xl">
        <div className="mb-8">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
            HdQaz Legal
          </p>
          <h1 className="max-w-4xl break-words text-[clamp(2.25rem,9vw,4.6rem)] font-bold leading-[0.98] tracking-[-0.028em] text-white">
            {document.title}
          </h1>
          <div className="mt-6 grid gap-2 rounded-[24px] border border-white/[0.1] bg-white/[0.055] p-4 text-sm font-medium leading-6 text-zinc-300 backdrop-blur-xl sm:grid-cols-2 sm:p-5">
            {document.meta.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>

        <div className="glass-strong rounded-[34px] px-5 py-7 sm:px-8 sm:py-9">
          <div className="space-y-4">
            {document.content.map((line, index) => (
              <LegalLine key={`${line}-${index}`} line={line} />
            ))}
          </div>
        </div>
      </article>
    </main>
  );
}

function LegalLine({ line }: { line: string }) {
  if (sectionHeadingPattern.test(line)) {
    return (
      <h2 className="border-t border-white/[0.1] pt-7 text-xl font-bold leading-8 tracking-[-0.012em] text-white first:border-t-0 first:pt-0 sm:text-2xl">
        {line}
      </h2>
    );
  }

  if (contactLabelPattern.test(line)) {
    return (
      <p className="pt-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
        {line}
      </p>
    );
  }

  return (
    <p
      className={
        numberedParagraphPattern.test(line)
          ? "text-[0.95rem] font-medium leading-7 text-zinc-300 sm:text-base sm:leading-8"
          : "text-[0.95rem] font-semibold leading-7 text-zinc-200 sm:text-base sm:leading-8"
      }
    >
      {line}
    </p>
  );
}
