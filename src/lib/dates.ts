const DAY_MS = 86_400_000;

/** Parses "YYYY-MM-DD" as a local date (new Date("YYYY-MM-DD") would be UTC). */
function parseDate(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole days from today until the date. Negative = in the past. */
export function daysUntil(date: string): number {
  return Math.round((parseDate(date).getTime() - startOfToday().getTime()) / DAY_MS);
}

export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "1 day overdue";
  if (days < 0) return `${-days} days overdue`;
  return `in ${days} days`;
}

export function formatDate(date: string): string {
  const d = parseDate(date);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

export type DeadlineTone = "overdue" | "soon" | "normal";

export function deadlineTone(days: number): DeadlineTone {
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "normal";
}
