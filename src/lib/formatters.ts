export function formatViewCount(value: number) {
  return new Intl.NumberFormat("kk-KZ").format(value);
}

export function formatCompactCount(value: number) {
  if (value < 1000) {
    return formatViewCount(value);
  }

  return new Intl.NumberFormat("kk-KZ", {
    maximumFractionDigits: value >= 10_000 ? 0 : 1,
    notation: "compact"
  }).format(value);
}

export function formatViewLabel(value: number, options: { compact?: boolean } = {}) {
  const formatted = options.compact ? formatCompactCount(value) : formatViewCount(value);

  return `${formatted} қаралым`;
}

export function formatKazakhDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("kk-KZ", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "long"
  }).format(new Date(value));
}

export function formatKazakhRelativeTime(value: string | Date) {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) {
    return "қазір";
  }

  const relative = new Intl.RelativeTimeFormat("kk-KZ", {
    numeric: "auto",
    style: "long"
  });

  if (absMs < hour) {
    return relative.format(Math.round(diffMs / minute), "minute");
  }

  if (absMs < day) {
    return relative.format(Math.round(diffMs / hour), "hour");
  }

  if (absMs < 7 * day) {
    return relative.format(Math.round(diffMs / day), "day");
  }

  return formatKazakhDateTime(date);
}
