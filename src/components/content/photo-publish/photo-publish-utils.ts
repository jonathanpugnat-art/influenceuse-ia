export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function mergeScheduleDateTime(
  dateStr: string,
  timeStr: string
): Date | null {
  if (!dateStr) return null;
  const [h, min] = (timeStr || "19:00").split(":").map(Number);
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(h || 19, min || 0, 0, 0);
  return d;
}
