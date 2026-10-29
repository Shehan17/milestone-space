export type ProjectStatus = "active" | "on_hold" | "completed";
export type ProjectType = "client" | "personal" | "study";
export type Priority = "low" | "medium" | "high";
export type TaskStatus = "todo" | "in_progress" | "done";

export const PROJECT_STATUSES: ProjectStatus[] = ["active", "on_hold", "completed"];
export const PROJECT_TYPES: ProjectType[] = ["client", "personal", "study"];
export const PRIORITIES: Priority[] = ["high", "medium", "low"];

export const TYPE_LABELS: Record<ProjectType, string> = {
  client: "Client",
  personal: "Personal",
  study: "Study",
};

/** Preset project colors. The project form also allows a custom color. */
export const PROJECT_COLORS = [
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f97316", // orange
  "#f43f5e", // rose
  "#ec4899", // pink
];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/**
 * Misc tasks: small everyday jobs with no project (project_id NULL), listed on the Misc page. They have
 * no milestone, due date or board status (db.ts enforces it). This is how they show where a project would.
 */
export const MISC_LABEL = "Misc";
/** Their dot is neutral (a theme color, so it follows the 5 themes). */
export const MISC_COLOR = "var(--faint)";

/** False for tasks of projects left out of a list (archived, completed); tasks with no project always count. */
export function inShownProject(task: { project_id: number | null }, shownProjectIds: Set<number>): boolean {
  return task.project_id === null || shownProjectIds.has(task.project_id);
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** Sort order for tasks: higher priority first, then earlier due date (no date last). */
export function byUrgency(a: Task, b: Task): number {
  return (
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
    a.id - b.id
  );
}

/** Today's plan: open tasks first, finished ones at the bottom (the Today page and the widget). */
export function byTodayOrder(a: Task, b: Task): number {
  return Number(a.is_done) - Number(b.is_done) || byUrgency(a, b);
}

// Dates are stored as "YYYY-MM-DD" strings (what <input type="date"> produces).
// created_at is an SQLite datetime string.

export interface ClientInput {
  name: string;
  email: string;
}

export interface Client extends ClientInput {
  id: number;
  /** Old free-text notes, copied to a note card by migration v12 and no longer shown or edited. */
  notes: string;
  created_at: string;
  project_count: number;
}

export interface ProjectInput {
  type: ProjectType;
  /** Only used when type is "client"; saved as NULL otherwise. */
  client_id: number | null;
  name: string;
  description: string;
  status: ProjectStatus;
  deadline: string | null;
  /** Hex color, e.g. "#8b5cf6". */
  color: string;
  /** The project's folder on this computer (absolute path); null when not set. */
  local_path: string | null;
}

export interface Project extends ProjectInput {
  id: number;
  created_at: string;
  /** When the project was pinned to the Today page; null when not pinned. */
  pinned_at: string | null;
  client_name: string | null;
  task_count: number;
  open_task_count: number;
}

export interface MilestoneInput {
  project_id: number;
  title: string;
  description: string;
  due_date: string | null;
}

export interface Milestone extends MilestoneInput {
  id: number;
  is_done: boolean;
  created_at: string;
  project_name: string;
  project_color: string;
}

export interface TaskInput {
  /** null for a task with no project; such a task has no milestone either. */
  project_id: number | null;
  milestone_id: number | null;
  title: string;
  priority: Priority;
  due_date: string | null;
  /** Saving also sets is_done (true exactly when status is "done"). */
  status: TaskStatus;
}

export interface Task extends TaskInput {
  id: number;
  is_done: boolean;
  /** Position within its board column; null = after the ordered ones. */
  board_order: number | null;
  /** The day ("YYYY-MM-DD") the task was picked for the Today list; null when not planned. */
  planned_for: string | null;
  /** When the task was moved to its project's stash (SQLite datetime); null when it isn't stashed. */
  stashed_at: string | null;
  created_at: string;
  /** null (both) for a task with no project. */
  project_name: string | null;
  project_color: string | null;
  milestone_title: string | null;
}

/** An idea or task captured with the quick capture shortcut, waiting to be sorted. */
export interface InboxItem {
  id: number;
  text: string;
  created_at: string;
}

/** A starting point for new projects: its type, color and description, plus milestones and tasks. */
export interface ProjectTemplateInput {
  name: string;
  type: ProjectType;
  color: string;
  description: string;
  /** "# Milestone" and "- Task" lines, see templates.ts. */
  outline: string;
}

export interface ProjectTemplate extends ProjectTemplateInput {
  id: number;
  created_at: string;
}

// ---------- Project info (links, details) ----------

export type LinkType = "github" | "figma" | "drive" | "store" | "website" | "docs" | "other";

export const LINK_TYPES: LinkType[] = ["github", "figma", "drive", "store", "website", "docs", "other"];

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
  github: "GitHub",
  figma: "Figma",
  drive: "Drive",
  store: "Store",
  website: "Website",
  docs: "Docs",
  other: "Other",
};

export interface ProjectLinkInput {
  project_id: number;
  title: string;
  url: string;
  type: LinkType;
}

export interface ProjectLink extends ProjectLinkInput {
  id: number;
  sort_order: number;
  created_at: string;
}

export interface ProjectDetailInput {
  project_id: number;
  label: string;
  value: string;
}

export interface ProjectDetail extends ProjectDetailInput {
  id: number;
  sort_order: number;
  created_at: string;
}

// ---------- Note cards (projects and clients) ----------

/** Whose notes: a project's or a client's. */
export type NoteOwner = { type: "project" | "client"; id: number };

export interface NoteInput {
  title: string;
  /** Markdown. "- [ ] " lines show as checkboxes that can be ticked on the card. */
  content: string;
  /** One of PROJECT_COLORS as a tint, or null for the plain card. */
  color: string | null;
}

export interface Note extends NoteInput {
  id: number;
  project_id: number | null;
  client_id: number | null;
  /** When it was pinned (pinned notes come first), NULL when not pinned. */
  pinned_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
