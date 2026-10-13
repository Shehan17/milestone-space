/**
 * The "New" dialog (QuickAdd.svelte, opened from the sidebar, or N where the page has no N of its own): a task for today, a task
 * for a project, an idea for the Inbox, a Misc task, or a project. It lives in the layout, so it tells the open page to reload with
 * notifyDataChanged(); pages that show tasks or projects listen with onDataChanged().
 */
import { emit, listen } from "@tauri-apps/api/event";
import { onMount } from "svelte";
import { MISC_LABEL } from "./types";

/** today: a task (in a project or Misc) on today's plan; task: a task in a project; misc: a Misc task, not planned. */
export type QuickAddKind = "today" | "task" | "idea" | "misc" | "project";

export const quickAdd = $state<{ open: boolean; kind: QuickAddKind }>({ open: false, kind: "today" });

/** The pill labels, shared by the New dialog and the quick capture window. */
export const KIND_LABELS: Record<QuickAddKind, string> = {
  today: "Today",
  task: "Project task",
  idea: "Inbox",
  misc: MISC_LABEL,
  project: "New project",
};

/** Kinds that add a task to a chosen project (Today may also pick Misc). */
export function picksProject(kind: QuickAddKind): boolean {
  return kind === "today" || kind === "task";
}

/** What ↑ / ↓ cycle through for the kind: Misc (null) first for Today, then each project; projects only for a project task. */
export function projectChoices(kind: QuickAddKind, projects: { id: number }[]): (number | null)[] {
  return [...(kind === "today" ? [null] : []), ...projects.map((p) => p.id)];
}

/** The item `by` steps from `current` in `items`, wrapping around (the first one if `current` isn't there). */
export function stepIn<T>(items: T[], current: T, by: number): T {
  const i = items.indexOf(current);
  if (i < 0) return items[0];
  return items[(i + by + items.length) % items.length];
}

export function openQuickAdd(kind: QuickAddKind = quickAdd.kind) {
  quickAdd.kind = kind;
  quickAdd.open = true;
}

const changes = new EventTarget();

/** Between windows: the quick capture window (/quick) adds tasks too. */
const DATA_CHANGED = "data-changed";

/** Tells the page that tasks or projects were added from outside it. */
export function notifyDataChanged() {
  changes.dispatchEvent(new Event("change"));
}

/** Tells the other windows (the main one, from /quick) that tasks or projects were added. */
export function notifyDataChangedEverywhere() {
  return emit(DATA_CHANGED);
}

/** Calls fn (the page's load) after a change from the New dialog or the quick capture window. Call it from component setup. */
export function onDataChanged(fn: () => void) {
  onMount(() => {
    changes.addEventListener("change", fn);
    const unlisten = listen(DATA_CHANGED, fn);
    return () => {
      changes.removeEventListener("change", fn);
      unlisten.then((stop) => stop());
    };
  });
}

/**
 * ← / → in a text field picks the previous / next kind (the New dialog, the quick capture window):
 * -1, 1, or 0 for other keys. Only while the caret is at the end of the text, so the arrows still
 * move the caret after a click or Home.
 */
export function kindStep(event: KeyboardEvent): number {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return 0;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return 0;
  const field = event.currentTarget as HTMLInputElement;
  const end = field.value.length;
  if (field.selectionStart !== end || field.selectionEnd !== end) return 0;
  event.preventDefault();
  return event.key === "ArrowRight" ? 1 : -1;
}

/** ↑ / ↓ in a text field picks the previous / next project for the task: -1, 1, or 0 for other keys. */
export function projectStep(event: KeyboardEvent): number {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return 0;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return 0;
  event.preventDefault();
  return event.key === "ArrowDown" ? 1 : -1;
}

// ----- Getting started (Today page) -----

const CAPTURED_KEY = "milestonespace.capturedIdea";

/** Remembers that an idea was captured once, for the Getting started list (a display hint). */
export function rememberCapture() {
  try {
    localStorage.setItem(CAPTURED_KEY, "1");
  } catch {
    // Not remembered; the step stays open.
  }
}

export function hasCaptured(): boolean {
  try {
    return localStorage.getItem(CAPTURED_KEY) === "1";
  } catch {
    return false;
  }
}
