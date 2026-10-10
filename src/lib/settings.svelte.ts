/**
 * App settings, edited on the Settings page.
 *
 * Saved by Rust as settings.json next to the database (settings-dev.json for the dev build,
 * see src-tauri/src/settings.rs). Rust reads close_to_tray, start_minimized and
 * quick_capture_keys itself; the rest is only used here. The color theme is the exception: it
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

export type StartPage = "/" | "/dashboard" | "/inbox" | "/projects" | "/tasks";
export type AccentId = "theme" | "violet" | "indigo" | "blue" | "teal" | "emerald" | "rose" | "amber";
export type Density = "compact" | "comfortable";
export type FontSize = "small" | "default" | "large" | "larger";
export type DateFormat = "d MMM yyyy" | "MMM d, yyyy" | "dd/MM/yyyy" | "MM/dd/yyyy" | "yyyy-MM-dd";
export type TimeFormat = "12h" | "24h";
export type WeekStart = "monday" | "sunday";
export type AutoBackup = "off" | "daily" | "weekly";

export interface Settings {
  // General (close_to_tray and start_minimized are read by Rust)
  close_to_tray: boolean;
  start_minimized: boolean;
  start_page: StartPage;

  // Appearance
  accent: AccentId;
  density: Density;
  font_size: FontSize;
  date_format: DateFormat;
  time_format: TimeFormat;
  week_start: WeekStart;

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

  // Projects and tasks
  default_project_type: ProjectType;
  default_priority: Priority;
  /** "archive": completed projects leave the lists and dashboard and wait in Projects → Archive. */
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
  accent: "theme",
  density: "compact",
  font_size: "default",
  date_format: "d MMM yyyy",
  time_format: "12h",
  week_start: "monday",
  notifications: true,
  reminder_days: [0, 1],
  daily_summary: true,
  notify_time: "09:00",
  quiet_hours: false,
  quiet_start: "22:00",
  quiet_end: "07:00",
  quick_capture_keys: null,
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

/** With "Move to Archive", completed projects are left out of lists, pickers and the dashboard. */
export function isArchived(project: Pick<Project, "status">): boolean {
  return settings.completed_projects === "archive" && project.status === "completed";
}
