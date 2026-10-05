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
    const params = new URLSearchParams({ limit: "8", offset: String(offset) });
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
  async function act(id: string, action: "retry" | "cancel" | "hide") {
    if (action === "cancel" && !window.confirm("Өңдеуді тоқтату керек пе? Жарияланған видео өзгермейді.")) return;
    setRetrying(id);setError("");
    try {
      const response = await fetch(`/api/automation/jobs/${id}/${action}`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
      const result=await response.json();if(!response.ok)throw new Error(result.error?.message ?? "Әрекет орындалмады.");
      setRevision(value=>value+1);
    }catch(error){setError(error instanceof Error ? error.message : "Әрекет орындалмады.");}finally{setRetrying(null);}
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
      <div className="mt-4 divide-y divide-white/10">
        {items.map(job => <div key={job.id} className="py-2">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate text-white">{job.content_title ?? "Контент"}{job.episode_id ? ` · ${job.episode_number ?? ""}-серия` : ""}</span>
            <span className={job.status === "ready" ? "text-emerald-300" : "text-zinc-400"}>{job.cancelled ? "Тоқтатылған" : labels[job.status]}</span>
            <span className="w-12 text-right">{job.progress_percent}%</span>
            {job.status === "failed" && <><button disabled={retrying!==null || job.attempt_count>=job.max_attempts} onClick={()=>void act(job.id,"retry")}>Қайталау</button><button disabled={retrying!==null} onClick={()=>void act(job.id,"hide")}>Жасыру</button></>}
            {["queued","downloading","processing","uploading"].includes(job.status) && <button disabled={retrying!==null} onClick={()=>void act(job.id,"cancel")}>Тоқтату</button>}
          </div>
          <details className="mt-1 text-xs text-zinc-400"><summary className="cursor-pointer">Толығырақ</summary>
            <p className="mt-2">Әрекет {job.attempt_count}/{job.max_attempts} · {new Date(job.created_at).toLocaleString("kk-KZ")}</p>
            {job.error_code && <p>{job.cancelled ? "Әкімші тоқтатты." : errorLabels[job.error_code] ?? "Өңдеу аяқталмады."}</p>}
            {job.status === "ready" && <p className="text-emerald-300">{job.telegram_review_state === "published" ? "Әкімші жариялаған" : "Адам тексеруін күтеді. Автоматты жарияланбайды."}</p>}
            {job.output_manifest_url && <a className="break-all underline" href={job.output_manifest_url} target="_blank" rel="noreferrer">Нәтижені ашу</a>}
            <p className="mt-1 break-all">Тапсырма: {job.id}</p>
          </details>
        </div>)}
      </div>
      <div className="mt-4 flex justify-end gap-3 text-sm">
        <button type="button" disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 8))} className="disabled:opacity-40">Алдыңғы</button>
        <button type="button" disabled={loading || !hasMore} onClick={() => setOffset(value => value + 8)} className="disabled:opacity-40">Келесі</button>
      </div>
    </section>
  );
}
