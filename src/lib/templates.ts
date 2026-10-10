/**
 * Project template outlines. A template's milestones and tasks are kept as plain text, one per
 * line, so they are quick to write and edit:
 *
 *   - Set up the repo        (a task without a milestone)
 *   # Design                 (a milestone)
 *   - Wireframes             (a task in the milestone above)
 *   - Mockups
 */
import type { Milestone, Task } from "./types";

export interface Outline {
  /** Tasks written before the first milestone. */
  tasks: string[];
  milestones: { title: string; tasks: string[] }[];
}

export function parseOutline(text: string): Outline {
  const outline: Outline = { tasks: [], milestones: [] };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      const title = line.replace(/^#+\s*/, "");
      if (title) outline.milestones.push({ title, tasks: [] });
      continue;
    }
    const title = line.replace(/^([-*]\s*)?(\[[ xX]?\]\s*)?/, "");
    if (!title) continue;
    (outline.milestones.at(-1)?.tasks ?? outline.tasks).push(title);
  }
  return outline;
}

/** The outline of an existing project, for "Save project as template". */
export function outlineFromProject(milestones: Milestone[], tasks: Task[]): string {
  const lines = tasks.filter((t) => t.milestone_id === null).map((t) => `- ${t.title}`);
  for (const m of milestones) {
    if (lines.length > 0) lines.push("");
    lines.push(`# ${m.title}`, ...tasks.filter((t) => t.milestone_id === m.id).map((t) => `- ${t.title}`));
  }
  return lines.join("\n");
}

/** "2 milestones · 7 tasks" */
export function describeOutline(text: string): string {
  const outline = parseOutline(text);
  const tasks = outline.tasks.length + outline.milestones.reduce((n, m) => n + m.tasks.length, 0);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return `${plural(outline.milestones.length, "milestone")} · ${plural(tasks, "task")}`;
}
