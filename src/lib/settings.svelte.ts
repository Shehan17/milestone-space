/**
 * App settings, edited on the Settings page.
 *
 * Saved by Rust as settings.json next to the database (settings-dev.json for the dev build,
 * see src-tauri/src/settings.rs). Rust reads close_to_tray, start_minimized,
 * quick_capture_keys, show_widget and widget_on_top itself; the rest is only used here. The color theme is the exception: it
 * stays in localStorage (theme.ts) so app.html can apply it before the first paint.
 *
 * Loaded once per window in +layout.ts, before any page renders. Every window keeps a copy;
 * saving tells the other windows (the quick capture box) to update theirs.
 */
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { applyAppearance } from "./theme";
import type { Priority, Project, ProjectType } from "./types";

/** Must match DEFAULT_QUICK_CAPTURE_KEYS in src-tauri/src/lib.rs. */
export const DEFAULT_QUICK_CAPTURE_KEYS = import.meta.env.DEV ? "Ctrl+Alt+Shift+Space" : "Ctrl+Shift+Space";

export type StartPage = "/" | "/inbox" | "/projects" | "/tasks";

/** The pages the app can open on (Settings → Start page). */
export const START_PAGES: { value: StartPage; label: string }[] = [
  { value: "/", label: "Today" },
  { value: "/inbox", label: "Inbox" },
  { value: "/projects", label: "Projects" },
  { value: "/tasks", label: "All tasks" },
];
export type AccentId = "theme" | "violet" | "indigo" | "blue" | "teal" | "emerald" | "rose" | "amber";
export type Density = "compact" | "comfortable";
export type FontSize = "small" | "default" | "large" | "larger";
export type DateFormat = "d MMM yyyy" | "MMM d, yyyy" | "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
export type TimeFormat = "12h" | "24h";
export type WeekStart = "monday" | "sunday";
export type AutoBackup = "off" | "daily" | "weekly";
export type DoneToggleSide = "left" | "right";

export interface Settings {
  // General (close_to_tray and start_minimized are read by Rust)
  close_to_tray: boolean;
  start_minimized: boolean;
  start_page: StartPage;
  /** Used in the Today page greeting ("Good morning, Sam"); empty = no name. */
  display_name: string;

  // Appearance
  accent: AccentId;
  density: Density;
  font_size: FontSize;
  /** The line under each page title that explains the page. */
  page_descriptions: boolean;
  /** Which end of a task row the round done toggle sits at. */
  done_toggle_side: DoneToggleSide;
  date_format: DateFormat;
  time_format: TimeFormat;
  week_start: WeekStart;
  /** The date and time in the middle of the title bar. */
  title_bar_clock: boolean;

  // Notifications. Times are "HH:MM" (24 h).
  notifications: boolean;
  /** Days before a deadline to remind: 0 = on the day. */
  reminder_days: number[];
  daily_summary: boolean;
  /** When the day's reminders and summary are sent. */
  notify_time: string;
  quiet_hours: boolean;
  quiet_start: string;
  quiet_end: string;

  // Shortcuts. null = DEFAULT_QUICK_CAPTURE_KEYS. Changed only with setQuickCaptureKeys().
  quick_capture_keys: string | null;

  // Today widget (a small window with today's plan). Owned by Rust: changed only with setWidgetShown()
  // and setWidgetOnTop(), which also act on the window; the tray menu changes show_widget too.
  show_widget: boolean;
  /** Above other windows. Off: on the desktop, behind them. */
  widget_on_top: boolean;

  // Projects and tasks
  default_project_type: ProjectType;
  default_priority: Priority;
  /** "archive": completed projects leave the lists and Today and wait in Projects → Archive. */
  completed_projects: "show" | "archive";

  // Data and backup
  auto_backup: AutoBackup;
  /** null = the "backups" folder next to the database. */
  backup_folder: string | null;
  /** How many app-made backups to keep in the folder; older ones are deleted. */
  backup_keep: number;
  /** ISO time of the last successful backup. */
  last_backup_at: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  close_to_tray: true,
  start_minimized: true,
  start_page: "/",
  display_name: "",
  accent: "theme",
  density: "compact",
  font_size: "default",
  page_descriptions: true,
  done_toggle_side: "right",
  date_format: "d MMM yyyy",
  time_format: "12h",
  week_start: "monday",
  title_bar_clock: true,
  notifications: true,
  reminder_days: [0, 1],
  daily_summary: true,
  notify_time: "09:00",
  quiet_hours: false,
  quiet_start: "22:00",
  quiet_end: "07:00",
  quick_capture_keys: null,
  show_widget: false,
  widget_on_top: false,
  default_project_type: "personal",
  default_priority: "medium",
  completed_projects: "show",
  auto_backup: "daily",
  backup_folder: null,
  backup_keep: 14,
  last_backup_at: null,
};

export const settings = $state<Settings>({ ...DEFAULT_SETTINGS });

const SETTINGS_CHANGED = "settings-changed";

function assign(values: Partial<Settings>) {
  Object.assign(settings, values);
  // A start page that no longer exists (the Dashboard was removed) opens Today instead.
  if (!START_PAGES.some((p) => p.value === settings.start_page)) settings.start_page = "/";
  applyAppearance(settings);
}

/** Reads the saved settings (missing fields keep their defaults) and keeps them in sync with other windows. */
export async function loadSettings() {
  try {
    assign({ ...DEFAULT_SETTINGS, ...(await invoke<Partial<Settings>>("get_settings")) });
  } catch (e) {
    console.error("Couldn't load the settings, using the defaults:", e);
    applyAppearance(settings);
  }
  listen<Settings>(SETTINGS_CHANGED, ({ payload }) => {
    if (JSON.stringify(payload) !== JSON.stringify(settings)) assign(payload);
  });
}

/** Saves the current settings and passes them to the other windows. */
export async function saveSettings() {
  applyAppearance(settings);
  const snapshot = $state.snapshot(settings);
  await invoke("save_settings", { settings: snapshot });
  await emit(SETTINGS_CHANGED, snapshot);
}

/** Changes a few settings and saves them. */
export function updateSettings(values: Partial<Settings>) {
  Object.assign(settings, values);
  return saveSettings();
}

export function quickCaptureKeys(): string {
  return settings.quick_capture_keys ?? DEFAULT_QUICK_CAPTURE_KEYS;
}

/**
 * Registers new quick capture keys (null = the default). Throws with a readable message if they
 * can't be used, e.g. when another app already has them; the old keys then stay.
 */
export async function setQuickCaptureKeys(keys: string | null) {
  await invoke<string>("set_quick_capture_keys", { keys });
  settings.quick_capture_keys = keys;
  await emit(SETTINGS_CHANGED, $state.snapshot(settings));
}

/** Shows or hides the Today widget (remembered for the next start). Rust tells every window. */
export async function setWidgetShown(shown: boolean) {
  await invoke("set_widget_shown", { shown });
  settings.show_widget = shown;
}

/** Keeps the Today widget above other windows, or puts it on the desktop behind them. */
export async function setWidgetOnTop(onTop: boolean) {
  await invoke("set_widget_on_top", { onTop });
  settings.widget_on_top = onTop;
}

/** With "Move to Archive", completed projects are left out of lists, pickers and Today. */
export function isArchived(project: Pick<Project, "status">): boolean {
  return settings.completed_projects === "archive" && project.status === "completed";
}
