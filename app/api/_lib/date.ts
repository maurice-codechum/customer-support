export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateToString(v: unknown): string {
  if (v instanceof Date) return formatLocalDate(v);
  return String(v);
}

export function timestampToIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}
