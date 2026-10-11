import { settings, type DateFormat } from "./settings.svelte";

const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

/** A Date's local day as "YYYY-MM-DD" (toISOString would give the UTC date). */
function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses "YYYY-MM-DD" as a local date (new Date("YYYY-MM-DD") would be UTC). */
function parseDate(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Today's local date as "YYYY-MM-DD". */
export function todayString(): string {
  return toDateString(new Date());
}

/** The local date `days` days from today as "YYYY-MM-DD". */
export function dayFromToday(days: number): string {
  const d = startOfToday();
  d.setDate(d.getDate() + days);
  return toDateString(d);
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

/**
 * How a deadline reads in lists: relative while it's close ("today", "in 3 days", "2 days overdue"),
 * the date itself from a week out ("12 Nov"), where "in 23 days" says less than the date.
 */
export function deadlineText(date: string): string {
  const days = daysUntil(date);
  return days < 7 ? relativeDays(days) : formatDate(date);
}

/** "Fri, 17 Oct": the date with its weekday, for tooltips and the date field. */
export function formatWeekdayDate(date: string): string {
  const weekday = parseDate(date).toLocaleDateString("en", { weekday: "short" });
  return `${weekday}, ${formatDate(date)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A date in the format picked on the Settings page. The worded formats leave out the current
 * year ("10 Oct"); the numeric ones always show it, since "10/12" alone is ambiguous.
 */
export function formatDate(date: string, format: DateFormat = settings.date_format): string {
  const d = parseDate(date);
  const [day, month, year] = [d.getDate(), d.getMonth(), d.getFullYear()];
  const withYear = year !== new Date().getFullYear();
  switch (format) {
    case "d MMM yyyy":
      return `${day} ${MONTHS[month]}${withYear ? ` ${year}` : ""}`;
    case "MMM d, yyyy":
      return `${MONTHS[month]} ${day}${withYear ? `, ${year}` : ""}`;
    case "dd/MM/yyyy":
      return `${pad(day)}/${pad(month + 1)}/${year}`;
    case "MM/dd/yyyy":
      return `${pad(month + 1)}/${pad(day)}/${year}`;
    case "yyyy-MM-dd":
      return `${year}-${pad(month + 1)}-${pad(day)}`;
  }
}

/** Whether the date format puts the day before the month. */
function dayFirst(): boolean {
  return settings.date_format !== "MMM d, yyyy" && settings.date_format !== "MM/dd/yyyy";
}

/** "Saturday, 10 October" (or "Saturday, October 10") — for page headings. */
export function formatLongDate(date: string): string {
  const d = parseDate(date);
  const weekday = d.toLocaleDateString("en", { weekday: "long" });
  const month = d.toLocaleDateString("en", { month: "long" });
  return dayFirst() ? `${weekday}, ${d.getDate()} ${month}` : `${weekday}, ${month} ${d.getDate()}`;
}

/** "HH:MM" (24 h, as saved in the settings) in the 12 h or 24 h format picked on the Settings page. */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (settings.time_format === "24h") return `${pad(h)}:${pad(m)}`;
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}

/** A Date (local time) as date and time, e.g. "10 Oct, 9:05 PM". */
export function formatDateTime(value: Date): string {
  return `${formatDate(toDateString(value))}, ${formatTime(`${value.getHours()}:${value.getMinutes()}`)}`;
}

/**
 * Whole days from today until the end of this week (0 on the last day of the week).
 * The week starts on Monday or Sunday, as set on the Settings page.
 */
export function daysLeftInWeek(): number {
  const weekday = new Date().getDay(); // 0 = Sunday
  const firstDay = settings.week_start === "sunday" ? 0 : 1;
  return 6 - ((weekday - firstDay + 7) % 7);
}

/** The first day of next week (Monday or Sunday, from Settings) as "YYYY-MM-DD". */
export function startOfNextWeek(): string {
  return dayFromToday(daysLeftInWeek() + 1);
}

/** "just now", "5 min ago", "3 h ago", "yesterday"... for created_at values (SQLite datetime('now'), UTC). */
export function timeAgo(sqliteDatetime: string): string {
  const then = new Date(sqliteDatetime.replace(" ", "T") + "Z");
  const minutes = Math.round((Date.now() - then.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(toDateString(then));
}

export type DeadlineTone = "overdue" | "soon" | "normal";

export function deadlineTone(days: number): DeadlineTone {
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "normal";
}
