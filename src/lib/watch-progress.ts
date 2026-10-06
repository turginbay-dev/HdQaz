export function resumableSeconds(raw: string | null, duration: number, fallback = 0) {
  let seconds = fallback;
  if (raw !== null) {
    try {
      const saved = JSON.parse(raw);
      if (!saved || typeof saved.completed !== "boolean" || typeof saved.seconds !== "number") return 0;
      seconds = saved.completed ? 0 : saved.seconds;
    } catch { return 0; }
  }
  return Number.isFinite(seconds) && seconds >= 30 && duration > 0 && seconds < duration * 0.9 ? seconds : 0;
}
