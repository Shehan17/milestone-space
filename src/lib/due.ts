/**
 * Everything with an open deadline (project deadlines, milestones, tasks) as one list, nearest
 * first. Used by the Today page (stats, Coming up).
 */
import type { IconName } from "./components/Icon.svelte";
import type { Milestone, Project, Task } from "./types";
import { inShownProject, MISC_COLOR, MISC_LABEL, TYPE_LABELS } from "./types";

export type DueKind = "Task" | "Milestone" | "Project";

export interface DueItem {
  key: string;
  kind: DueKind;
  title: string;
  /** The project page, on the tab that shows this item (Misc for a Misc task). */
  href: string;
  context: string;
  color: string;
  date: string;
}

export const DUE_KIND_ICONS: Record<DueKind, IconName> = { Task: "tasks", Milestone: "flag", Project: "projects" };

/** Open items with a date. Work on completed projects no longer counts as due; Misc tasks have no due date. */
export function dueItems(projects: Project[], milestones: Milestone[], tasks: Task[]): DueItem[] {
  const shown = new Set(projects.filter((p) => p.status !== "completed").map((p) => p.id));
  return [
    ...projects
      .filter((p) => p.status !== "completed" && p.deadline)
      .map((p): DueItem => ({
        key: `p${p.id}`,
        kind: "Project",
        title: p.name,
        href: `/projects/${p.id}`,
        context: p.client_name ?? TYPE_LABELS[p.type],
        color: p.color,
        date: p.deadline!,
      })),
    ...milestones
      .filter((m) => !m.is_done && m.due_date && shown.has(m.project_id))
      .map((m): DueItem => ({
        key: `m${m.id}`,
        kind: "Milestone",
        title: m.title,
        href: `/projects/${m.project_id}?tab=milestones`,
        context: m.project_name,
        color: m.project_color,
        date: m.due_date!,
      })),
    ...tasks
      .filter((t) => !t.is_done && t.due_date && inShownProject(t, shown))
      .map((t): DueItem => ({
        key: `t${t.id}`,
        kind: "Task",
        title: t.title,
        href: t.project_id === null ? "/misc" : `/projects/${t.project_id}?tab=tasks`,
        context: t.project_name ?? MISC_LABEL,
        color: t.project_color ?? MISC_COLOR,
        date: t.due_date!,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}
