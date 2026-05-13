"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, MoreHorizontal, Send, Shield, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/user/user-avatar";
import type { MovieComment } from "@/features/engagement/types";
import { cn } from "@/lib/cn";
import { formatKazakhRelativeTime } from "@/lib/formatters";

type CommentsSectionProps = {
  comments: MovieComment[];
  currentUserId?: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  movieSlug: string;
};

type ApiCommentResponse = {
  data?: MovieComment;
  error?: {
    message?: string;
    details?: Record<string, string>;
  };
};

const commentLimit = 500;

async function readApiError(response: Response, fallback: string) {
  const result = (await response.json().catch(() => null)) as ApiCommentResponse | null;
  const details = result?.error?.details;
  const firstDetail = details ? Object.values(details)[0] : null;

  return firstDetail ?? result?.error?.message ?? fallback;
}

function apiResultError(result: ApiCommentResponse | null, fallback: string) {
  const details = result?.error?.details;
  const firstDetail = details ? Object.values(details)[0] : null;

  return firstDetail ?? result?.error?.message ?? fallback;
}

export function CommentsSection({
  comments: initialComments,
  currentUserId,
  isAdmin,
  isAuthenticated,
  movieSlug
}: CommentsSectionProps) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [openedSpoilers, setOpenedSpoilers] = useState<Set<string>>(() => new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const trimmedBody = body.trim();
  const canSubmit = isAuthenticated && trimmedBody.length > 0 && trimmedBody.length <= commentLimit && !pending;

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  const sortedComments = useMemo(() => comments, [comments]);

  async function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!trimmedBody) {
      setFeedback("Пікір жазу үшін мәтін енгізіңіз.");
      return;
    }

    if (trimmedBody.length > commentLimit) {
      setFeedback(`Пікір ${commentLimit} таңбадан аспауы керек.`);
      return;
    }

    setPending("new");
    setFeedback(null);

    try {
      const response = await fetch("/api/engagement/comments", {
        body: JSON.stringify({
          body: trimmedBody,
          isSpoiler,
          movieSlug
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const result = (await response.json().catch(() => null)) as ApiCommentResponse | null;
      const comment = result?.data;

      if (!response.ok || !comment) {
        throw new Error(apiResultError(result, "Пікір жіберу мүмкін болмады"));
      }

      setComments((current) => [comment, ...current]);
      setBody("");
      setIsSpoiler(false);
      setFeedback("Пікір жіберілді.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Пікір жіберу мүмкін болмады");
    } finally {
      setPending(null);
    }
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm("Пікірді өшіру керек пе?")) {
      return;
    }

    setPending(commentId);
    setFeedback(null);

    try {
      const response = await fetch(`/api/engagement/comments/${encodeURIComponent(commentId)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Пікірді өшіру мүмкін болмады"));
      }

      setComments((current) => current.filter((comment) => comment.id !== commentId));
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Пікірді өшіру мүмкін болмады");
    } finally {
      setPending(null);
    }
  }

  async function moderate(commentId: string, action: "hide" | "restore" | "mark_spoiler" | "remove_spoiler") {
    if (action === "hide" && !window.confirm("Пікірді модерация арқылы жасыру керек пе?")) {
      return;
    }

    if (action === "restore" && !window.confirm("Пікірді қайта көрсету керек пе?")) {
      return;
    }

    setPending(commentId);
    setFeedback(null);

    try {
      const response = await fetch(`/api/engagement/comments/${encodeURIComponent(commentId)}`, {
        body: JSON.stringify({
          action,
          hiddenReason: action === "hide" ? "Модерация" : undefined
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "PATCH"
      });
      const result = (await response.json().catch(() => null)) as ApiCommentResponse | null;
      const comment = result?.data;

      if (!response.ok || !comment) {
        throw new Error(apiResultError(result, "Модерация орындалмады"));
      }

      if (action === "mark_spoiler") {
        setOpenedSpoilers((current) => {
          const next = new Set(current);
          next.delete(commentId);
          return next;
        });
      }

      setComments((current) => current.map((item) => (item.id === commentId ? comment : item)));
      setOpenMenuId(null);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Модерация орындалмады");
    } finally {
      setPending(null);
    }
  }

  return (
    <section id="comments" className="scroll-mt-28">
      <div className="glass-strong rounded-[30px] p-4 shadow-[0_32px_120px_rgba(0,0,0,0.5)] sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent)]">Пікірлер</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-white">Пікір жазу</h2>
          </div>
          {!isAuthenticated ? (
            <button
              className="glass-button inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold text-white"
              type="button"
              onClick={() => router.push("/login")}
            >
              Кіру қажет
            </button>
          ) : null}
        </div>

        <form className="rounded-[26px] border border-white/10 bg-black/20 p-3 sm:p-4" onSubmit={submitComment}>
          <p className="mb-3 text-xs font-medium leading-5 tracking-[0.004em] text-zinc-400">
            Пікір жазғанда бір-бірімізді құрметтейік. Боқтық сөз, қорлау, спам және спойлерді ескертусіз жазуға болмайды.
          </p>
          <textarea
            className="min-h-28 w-full resize-none rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-[rgba(217,183,111,0.45)] focus:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
            maxLength={commentLimit}
            disabled={!isAuthenticated || pending === "new"}
            placeholder={isAuthenticated ? "Пікіріңізді жазыңыз..." : "Кіру қажет"}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300">
              <input
                className="h-4 w-4 accent-[var(--accent)]"
                type="checkbox"
                checked={isSpoiler}
                disabled={!isAuthenticated || pending === "new"}
                onChange={(event) => setIsSpoiler(event.target.checked)}
              />
              Спойлер бар
            </label>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-xs font-medium text-zinc-500">
                {body.length}/{commentLimit}
              </span>
              <button
                className="cinema-sweep inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-black transition hover:bg-[#f3ead5] disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={!canSubmit}
              >
                {pending === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Жіберу
              </button>
            </div>
          </div>
        </form>

        {feedback ? <p className="mt-3 text-sm font-medium text-[var(--accent)]">{feedback}</p> : null}

        <div className="mt-6 grid gap-3">
          {sortedComments.length > 0 ? (
            sortedComments.map((comment) => {
              const isOwner = currentUserId === comment.userId;
              const menuOpen = openMenuId === comment.id;

              return (
                <article
                  key={comment.id}
                  className={cn(
                    "rounded-[24px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.28)]",
                    comment.isHidden && "border-red-400/20 bg-red-500/[0.055]"
                  )}
                >
                  <div className="flex gap-3">
                    <UserAvatar
                      avatarUrl={comment.author.avatarUrl}
                      displayName={comment.author.displayName}
                      className="h-11 w-11"
                      sizes="44px"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="truncate text-sm font-bold tracking-[-0.008em] text-white">
                          {comment.author.displayName || "HdQaz қолданушысы"}
                        </h3>
                        <time
                          className="text-xs font-medium tracking-[0.004em] text-zinc-500"
                          dateTime={comment.createdAt}
                          suppressHydrationWarning
                        >
                          {formatKazakhRelativeTime(comment.createdAt)}
                        </time>
                        {comment.isSpoiler ? (
                          <span className="rounded-full border border-[rgba(217,183,111,0.24)] bg-[rgba(217,183,111,0.1)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
                            Спойлер
                          </span>
                        ) : null}
                        {comment.isHidden && isAdmin ? (
                          <span className="rounded-full border border-red-300/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-red-200">
                            Жасырылған
                          </span>
                        ) : null}
                      </div>

                      <CommentBody
                        comment={comment}
                        isAdmin={isAdmin}
                        opened={openedSpoilers.has(comment.id)}
                        onOpen={() =>
                          setOpenedSpoilers((current) => {
                            const next = new Set(current);
                            next.add(comment.id);
                            return next;
                          })
                        }
                      />

                      {comment.isHidden && isAdmin && comment.hiddenReason ? (
                        <p className="mt-2 text-xs text-red-100/70">Себебі: {comment.hiddenReason}</p>
                      ) : null}
                    </div>

                    {(isOwner || isAdmin) ? (
                      <div className="relative shrink-0">
                        <button
                          className="glass-button flex h-9 w-9 items-center justify-center rounded-full text-white"
                          type="button"
                          aria-label="Пікір әрекеттері"
                          onClick={() => setOpenMenuId(menuOpen ? null : comment.id)}
                        >
                          {pending === comment.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </button>

                        {menuOpen ? (
                          <div className="glass-strong absolute right-0 top-11 z-20 w-56 rounded-2xl p-2">
                            {isOwner || isAdmin ? (
                              <MenuButton icon={<Trash2 className="h-4 w-4" />} label="Пікірді өшіру" onClick={() => deleteComment(comment.id)} />
                            ) : null}
                            {isAdmin ? (
                              <>
                                {comment.isHidden ? (
                                  <MenuButton icon={<Eye className="h-4 w-4" />} label="Қалпына келтіру" onClick={() => moderate(comment.id, "restore")} />
                                ) : (
                                  <MenuButton icon={<EyeOff className="h-4 w-4" />} label="Жасыру" onClick={() => moderate(comment.id, "hide")} />
                                )}
                                {comment.isSpoiler ? (
                                  <MenuButton icon={<Shield className="h-4 w-4" />} label="Спойлер белгісін алу" onClick={() => moderate(comment.id, "remove_spoiler")} />
                                ) : (
                                  <MenuButton icon={<Shield className="h-4 w-4" />} label="Спойлер деп белгілеу" onClick={() => moderate(comment.id, "mark_spoiler")} />
                                )}
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.045] px-5 py-8 text-center">
              <p className="text-sm font-semibold text-zinc-300">Әзірге пікір жоқ. Алғашқы пікірді сіз жазыңыз.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CommentBody({
  comment,
  isAdmin,
  onOpen,
  opened
}: {
  comment: MovieComment;
  isAdmin: boolean;
  onOpen: () => void;
  opened: boolean;
}) {
  if (comment.isHidden && !isAdmin) {
    return (
      <p className="mt-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-medium leading-6 text-zinc-400">
        Бұл пікір модерация арқылы жасырылды.
      </p>
    );
  }

  if (comment.isSpoiler && !opened && !comment.isHidden) {
    return (
      <div className="relative mt-2 overflow-hidden rounded-2xl">
        <p className="select-none whitespace-pre-wrap rounded-2xl border border-white/5 bg-black/10 px-4 py-3 text-sm font-medium leading-6 text-zinc-200 opacity-60 blur-lg transition duration-300">
          {comment.body}
        </p>
        <button
          className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-black/45 px-4 text-center text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition hover:bg-black/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
          type="button"
          aria-label="Спойлер пікірді ашу"
          onClick={onOpen}
        >
          <EyeOff className="mb-1 h-4 w-4 text-[var(--accent)]" />
          <span className="text-sm font-bold tracking-[-0.008em]">Спойлер болуы мүмкін</span>
          <span className="mt-0.5 text-xs font-medium text-zinc-300">Көру үшін ашыңыз</span>
        </button>
      </div>
    );
  }

  return (
    <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-zinc-200">
      {comment.body}
    </p>
  );
}

function MenuButton({
  icon,
  label,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-zinc-200 transition hover:bg-white/10 hover:text-white"
      type="button"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
