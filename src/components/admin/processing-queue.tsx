"use client";

import { useEffect, useState } from "react";
import type { ProcessingJobView, ProcessingStatus } from "@/types/processing";

const labels: Record<ProcessingStatus, string> = {
  queued: "Кезекте", downloading: "Жүктелуде", processing: "Өңделуде", uploading: "Сақталуда", ready: "Дайын", failed: "Қате"
};
const errorLabels: Record<string, string> = {
  download_failed: "Бастапқы файл жүктелмеді.", invalid_media: "Видео файлы жарамсыз.", processing_failed: "Видео өңделмеді.",
  upload_failed: "Нәтиже сақталмады.", lease_expired: "Өңдеушіден жауап келмеді.", internal_error: "Өңдеу аяқталмады."
};
type QueueResult = { data?: { items: ProcessingJobView[]; has_more: boolean }; error?: { message?: string } };

export function ProcessingQueue() {
  const [items, setItems] = useState<ProcessingJobView[]>([]);
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ limit: "25", offset: String(offset) });
    if (status) params.set("status", status);
    void fetch(`/api/automation/jobs?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const result = await response.json() as QueueResult;
        if (!response.ok || !result.data) throw new Error("queue_unavailable");
        if (!controller.signal.aborted) {
          setItems(result.data.items); setHasMore(result.data.has_more); setError("");
        }
      }).catch(() => { if (!controller.signal.aborted) setError("Кезек жүктелмеді. Қайта жаңартып көріңіз."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [offset, status, revision]);
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible") setRevision(value => value + 1); }, 15000);
    return () => clearInterval(timer);
  }, []);
  async function retry(id: string) {
    setRetrying(id); setError("");
    try {
      const response = await fetch(`/api/automation/jobs/${id}/retry`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
      });
      if (!response.ok) throw new Error("retry_failed");
      setRevision(value => value + 1);
    } catch { setError("Қайта кезекке қою мүмкін болмады. Күйі өзгерген немесе әрекет шегі біткен болуы мүмкін."); }
    finally { setRetrying(null); }
  }
  return (
    <section aria-labelledby="processing-queue-title" className="glass mb-8 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="processing-queue-title" className="text-xl font-semibold text-white">Өңдеу кезегі</h2>
          <p className="mt-1 text-sm text-zinc-400">Дайын нәтиже адам тексергенше жарияланбайды.</p>
        </div>
        <div className="flex gap-2">
          <select aria-label="Өңдеу күйі" value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }} className="rounded-xl border border-white/15 bg-zinc-900 p-2 text-sm text-white">
            <option value="">Барлық күй</option>
            {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" disabled={loading} onClick={() => setRevision(value => value + 1)} className="glass-button rounded-xl px-3 py-2 text-sm disabled:opacity-50">Жаңарту</button>
        </div>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      {loading && <p role="status" className="mt-4 text-sm text-zinc-400">Кезек жүктелуде…</p>}
      {!loading && !error && !items.length && <p className="mt-4 text-sm text-zinc-400">Бұл күйде тапсырма жоқ.</p>}
      <div className="mt-4 grid gap-3">
        {items.map(job => (
          <article key={job.id} className="rounded-2xl border border-white/10 p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words font-semibold text-white">{job.content_title ?? job.content_id}</h3>
                {job.episode_id && <p className="text-sm text-zinc-400">{job.episode_number}-серия{job.episode_title ? ` · ${job.episode_title}` : ""}</p>}
              </div>
              <span className={job.status === "ready" ? "text-emerald-300" : job.status === "failed" ? "text-red-300" : "text-zinc-300"}>{labels[job.status]}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-zinc-400">
              <span>Кезең: {job.stage ? labels[job.stage] : "—"}</span>
              <span>{job.progress_percent}%</span>
              <span>Әрекет: {job.attempt_count}/{job.max_attempts}</span>
              <time dateTime={job.created_at}>{new Date(job.created_at).toLocaleString("kk-KZ")}</time>
            </div>
            <progress aria-label="Өңдеу барысы" max={100} value={job.progress_percent} className="mt-3 h-2 w-full accent-emerald-400" />
            {job.error_code && <p className="mt-2 text-sm text-red-300">{errorLabels[job.error_code] ?? "Өңдеу аяқталмады."}</p>}
            {job.status === "ready" && job.output_manifest_url && (
              <div className="mt-3 text-sm">
                <p className="text-emerald-300">{job.telegram_review_state === "published" ? "Жарияланған · әкімші растады" : job.telegram_review_state === "rejected" ? "Қабылданбаған · жарияланбаған" : "Дайын · тексеруді күтеді"}</p>
                <p className="mt-1 break-all text-zinc-300">{job.output_manifest_url}</p>
                <p className="mt-1 text-zinc-500">{job.telegram_review_state === "published" ? "Нәтиже әкімшінің нақты растауымен бекітілді." : "Сайттағы видео сілтемесі өзгерген жоқ."}</p>
              </div>
            )}
            {job.status === "failed" && (job.attempt_count < job.max_attempts
              ? <button type="button" disabled={retrying !== null} onClick={() => void retry(job.id)} className="glass-button mt-3 rounded-xl px-3 py-2 text-sm disabled:opacity-50">{retrying === job.id ? "Кезекке қойылуда…" : "Қайта орындау"}</button>
              : <p className="mt-2 text-sm text-zinc-500">Әрекет шегіне жетті.</p>)}
          </article>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-3 text-sm">
        <button type="button" disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 25))} className="disabled:opacity-40">Алдыңғы</button>
        <button type="button" disabled={loading || !hasMore} onClick={() => setOffset(value => value + 25)} className="disabled:opacity-40">Келесі</button>
      </div>
    </section>
  );
}
