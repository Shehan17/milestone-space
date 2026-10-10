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

// Dates are stored as "YYYY-MM-DD" strings (what <input type="date"> produces).
// created_at is an SQLite datetime string.

export interface ClientInput {
  name: string;
  email: string;
  notes: string;
}

export interface Client extends ClientInput {
  id: number;
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
  /** When the project was pinned to the dashboard; null when not pinned. */
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
  project_id: number;
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
  created_at: string;
  project_name: string;
  project_color: string;
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

// ---------- Project info (notes, links, details) ----------

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

/** One markdown note per project. */
export interface ProjectNote {
  id: number;
  project_id: number;
  content: string;
  updated_at: string;
}

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
