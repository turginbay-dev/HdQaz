"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";

type ProfileNameEditorProps = {
  initialName: string;
};

type ProfileResponse = {
  error?: {
    message?: string;
    details?: Record<string, string>;
  };
};

async function readProfileError(response: Response) {
  const result = (await response.json().catch(() => null)) as ProfileResponse | null;
  const details = result?.error?.details;

  return (details ? Object.values(details)[0] : null) ?? result?.error?.message ?? "Есімді жаңарту мүмкін болмады";
}

export function ProfileNameEditor({ initialName }: ProfileNameEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function saveName() {
    const nextName = draft.trim();

    if (nextName.length < 2 || nextName.length > 40) {
      setFeedback("Жаңа есім 2-40 таңба болуы керек.");
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/me", {
        body: JSON.stringify({ displayName: nextName }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });

      if (!response.ok) {
        throw new Error(await readProfileError(response));
      }

      setName(nextName);
      setEditing(false);
      setFeedback("Есім сәтті жаңартылды");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Есімді жаңарту мүмкін болмады");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div>
        <div className="flex items-center gap-2">
          <h1 className="min-w-0 truncate text-2xl font-bold tracking-[-0.018em] text-white">{name}</h1>
          <button
            className="glass-button flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
            type="button"
            aria-label="Есімді өзгерту"
            onClick={() => {
              setDraft(name);
              setEditing(true);
              setFeedback(null);
            }}
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        {feedback ? <p className="mt-2 text-xs font-medium text-[var(--accent)]">{feedback}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-[22px] border border-white/10 bg-black/20 p-3">
      <label className="block">
        <span className="text-xs font-semibold text-zinc-400">Жаңа есім</span>
        <input
          className="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-semibold text-white outline-none transition focus:border-[rgba(217,183,111,0.45)]"
          maxLength={40}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="cinema-sweep inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-black disabled:opacity-60"
          type="button"
          disabled={saving}
          onClick={saveName}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Сақтау
        </button>
        <button
          className="glass-button inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-bold text-white"
          type="button"
          disabled={saving}
          onClick={() => {
            setEditing(false);
            setFeedback(null);
          }}
        >
          <X className="h-4 w-4" />
          Бас тарту
        </button>
      </div>
      {feedback ? <p className="mt-2 text-xs font-medium text-[var(--accent)]">{feedback}</p> : null}
    </div>
  );
}
