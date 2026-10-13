/**
 * Deadline reminders and the daily summary, shown as Windows notifications.
 *
 * The main window checks once a minute (it keeps running while hidden in the tray). Once a day,
 * at the first check after the notification time and outside quiet hours, it sends that day's
 * notifications. If the app wasn't running at that time, they come when it starts.
 */
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { getMilestones, getProjects, getTasks } from "./db";
import { dayFromToday, formatDate, todayString } from "./dates";
import { settings } from "./settings.svelte";
import { MISC_LABEL } from "./types";

/** The last day ("YYYY-MM-DD") the notifications were sent. Per computer, so localStorage. */
const SENT_KEY = "milestonespace.notified-day";

function minutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function inQuietHours(now = new Date()): boolean {
  if (!settings.quiet_hours) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  const start = minutes(settings.quiet_start);
  const end = minutes(settings.quiet_end);
  // Quiet hours usually pass midnight (22:00 to 07:00).
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

async function notify(title: string, body: string) {
  let granted = await isPermissionGranted();
  if (!granted) granted = (await requestPermission()) === "granted";
  if (granted) sendNotification({ title, body });
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function whenLabel(days: number, date: string): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days (${formatDate(date)})`;
}

interface Due {
  title: string;
  kind: "Task" | "Milestone" | "Project";
  project: string;
  date: string;
}

/** Open tasks, milestones and project deadlines, leaving out completed projects. */
async function openDeadlines(): Promise<{ due: Due[]; plannedToday: number }> {
  const [projects, milestones, tasks] = await Promise.all([getProjects(), getMilestones(), getTasks()]);
  const closed = new Set(projects.filter((p) => p.status === "completed").map((p) => p.id));
  const due: Due[] = [
    ...projects
      .filter((p) => p.status !== "completed" && p.deadline)
      .map((p) => ({ title: p.name, kind: "Project" as const, project: p.name, date: p.deadline! })),
    ...milestones
      .filter((m) => !m.is_done && m.due_date && !closed.has(m.project_id))
      .map((m) => ({ title: m.title, kind: "Milestone" as const, project: m.project_name, date: m.due_date! })),
    ...tasks
      .filter((t) => !t.is_done && t.due_date && (t.project_id === null || !closed.has(t.project_id)))
      .map((t) => ({ title: t.title, kind: "Task" as const, project: t.project_name ?? MISC_LABEL, date: t.due_date! })),
  ];
  const today = todayString();
  const plannedToday = tasks.filter((t) => !t.is_done && t.planned_for === today).length;
  return { due, plannedToday };
}

async function sendSummary(due: Due[], plannedToday: number) {
  const today = todayString();
  const dueToday = due.filter((d) => d.date === today).length;
  const overdue = due.filter((d) => d.date < today).length;
  const parts = [
    dueToday > 0 ? `${plural(dueToday, "deadline")} today` : "Nothing due today",
    overdue > 0 ? `${overdue} overdue` : "",
    plannedToday > 0 ? `${plural(plannedToday, "task")} on your Today list` : "",
  ].filter(Boolean);
  await notify("Your day in MilestoneSpace", parts.join(" · "));
}

async function sendReminders(due: Due[]) {
  for (const days of [...settings.reminder_days].sort((a, b) => a - b)) {
    const date = dayFromToday(days);
    const items = due.filter((d) => d.date === date);
    if (items.length === 0) continue;
    const when = whenLabel(days, date);
    if (items.length <= 3) {
      for (const item of items) {
        await notify(`Due ${when}: ${item.title}`, item.kind === "Project" ? "Project deadline" : `${item.kind} · ${item.project}`);
      }
    } else {
      const names = items.slice(0, 3).map((i) => i.title).join(", ");
      await notify(`${items.length} deadlines ${when}`, `${names} and ${items.length - 3} more`);
    }
  }
}

function sentToday(): boolean {
  try {
    return localStorage.getItem(SENT_KEY) === todayString();
  } catch {
    return false;
  }
}

function markSent() {
  try {
    localStorage.setItem(SENT_KEY, todayString());
  } catch {
    // Not remembered: at worst the notifications come again after a restart.
  }
}

/** Sends today's notifications if they are due. */
export async function checkNotifications(now = new Date()) {
  if (!settings.notifications || sentToday()) return;
  if (!settings.daily_summary && settings.reminder_days.length === 0) return;
  if (now.getHours() * 60 + now.getMinutes() < minutes(settings.notify_time) || inQuietHours(now)) return;
  markSent(); // first, so a slow check can't send twice
  const { due, plannedToday } = await openDeadlines();
  if (settings.daily_summary) await sendSummary(due, plannedToday);
  if (settings.reminder_days.length > 0) await sendReminders(due);
}

/** The Settings page's "Send a test" button: shows what today's notifications would say, right away. */
export async function sendTestNotification() {
  const { due, plannedToday } = await openDeadlines();
  await sendSummary(due, plannedToday);
}
