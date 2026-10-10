/**
 * Backups, restore and export (Settings → Data and backup). Rust picks the file names, cleans up
 * old backups and swaps files on restore (src-tauri/src/data.rs); the copy itself is VACUUM INTO.
 */
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { backupDatabaseTo, closeDatabase, getAllData, getProjects, getTasks } from "./db";
import { settings, updateSettings } from "./settings.svelte";
import { STATUS_LABELS, TASK_STATUS_LABELS, PRIORITY_LABELS, TYPE_LABELS } from "./types";

export interface AppPaths {
  data_dir: string;
  database: string;
  default_backup_dir: string;
}

let paths: Promise<AppPaths> | null = null;

export function appPaths(): Promise<AppPaths> {
  paths ??= invoke<AppPaths>("app_paths");
  return paths;
}

export async function backupFolder(): Promise<string> {
  return settings.backup_folder ?? (await appPaths()).default_backup_dir;
}

/** Local time for file names: "2026-10-10_093005". */
function stamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

/** Saves a backup in the backup folder, then deletes the oldest ones beyond the number to keep. Returns its path. */
export async function backupNow(): Promise<string> {
  const folder = await backupFolder();
  const path = await invoke<string>("new_backup_path", { folder, stamp: stamp() });
  await backupDatabaseTo(path);
  await invoke("prune_backups", { folder, keep: settings.backup_keep });
  await updateSettings({ last_backup_at: new Date().toISOString() });
  return path;
}

const BACKUP_INTERVAL_DAYS = { daily: 1, weekly: 7 } as const;

/** Whether automatic backups are on and the last one is old enough. */
export function autoBackupDue(): boolean {
  if (settings.auto_backup === "off") return false;
  if (!settings.last_backup_at) return true;
  const age = Date.now() - new Date(settings.last_backup_at).getTime();
  return age >= BACKUP_INTERVAL_DAYS[settings.auto_backup] * 86_400_000 - 60_000;
}

/** The last automatic backup error, shown on the Settings page (null when the last one worked). */
export const autoBackupStatus = $state<{ error: string | null }>({ error: null });

/** Makes the automatic backup when it's due. Called on start and then every few minutes. */
export async function runAutoBackup() {
  if (!autoBackupDue()) return;
  try {
    await backupNow();
    autoBackupStatus.error = null;
  } catch (e) {
    // Usually the folder is missing (e.g. Google Drive not running). Try again next time.
    autoBackupStatus.error = String(e);
  }
}

/**
 * Replaces all data with a backup file. A copy of the current data is saved next to the
 * database first. The caller must reload the page afterwards (the database is closed).
 * Returns the path of that copy.
 */
export async function restoreBackup(path: string): Promise<string> {
  await invoke("check_backup", { path });
  const safetyCopy = await invoke<string>("safety_backup_path", { stamp: stamp() });
  await backupDatabaseTo(safetyCopy);
  await closeDatabase();
  await invoke("restore_backup", { path });
  return safetyCopy;
}

// ---------- Export ----------

async function saveText(defaultName: string, contents: string, filter: { name: string; extensions: string[] }) {
  const path = await save({ defaultPath: defaultName, filters: [filter] });
  if (!path) return null;
  await invoke("write_text_file", { path, contents });
  return path;
}

/** Everything in one JSON file. Returns the saved path, or null if cancelled. */
export async function exportJson(): Promise<string | null> {
  const data = {
    app: "MilestoneSpace",
    version: await getVersion(),
    exported_at: new Date().toISOString(),
    ...(await getAllData()),
  };
  return saveText(`milestonespace-${stamp().slice(0, 10)}.json`, JSON.stringify(data, null, 2), {
    name: "JSON",
    extensions: ["json"],
  });
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(header: string[], rows: unknown[][]): string {
  // The byte order mark makes Excel read the file as UTF-8.
  return "﻿" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export async function exportTasksCsv(): Promise<string | null> {
  const tasks = await getTasks();
  const csv = toCsv(
    ["Title", "Project", "Milestone", "Status", "Priority", "Due date", "Planned for", "Created"],
    tasks.map((t) => [
      t.title,
      t.project_name,
      t.milestone_title,
      TASK_STATUS_LABELS[t.status],
      PRIORITY_LABELS[t.priority],
      t.due_date,
      t.planned_for,
      t.created_at,
    ])
  );
  return saveText(`milestonespace-tasks-${stamp().slice(0, 10)}.csv`, csv, { name: "CSV", extensions: ["csv"] });
}

export async function exportProjectsCsv(): Promise<string | null> {
  const projects = await getProjects();
  const csv = toCsv(
    ["Name", "Type", "Client", "Status", "Deadline", "Open tasks", "All tasks", "Description", "Folder", "Created"],
    projects.map((p) => [
      p.name,
      TYPE_LABELS[p.type],
      p.client_name,
      STATUS_LABELS[p.status],
      p.deadline,
      p.open_task_count,
      p.task_count,
      p.description,
      p.local_path,
      p.created_at,
    ])
  );
  return saveText(`milestonespace-projects-${stamp().slice(0, 10)}.csv`, csv, { name: "CSV", extensions: ["csv"] });
}
