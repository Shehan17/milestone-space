/**
 * Keyboard shortcuts. One window keydown listener (in +layout.svelte) calls handleGlobalKey:
 * it handles "g then a letter" navigation, "?" and "j" itself, then passes other keys to the
 * page that is showing, which registers its own keys with useShortcuts().
 *
 * When adding a shortcut, also add it to shortcutGroups() so the help dialog and the Settings page list it.
 * Task rows handle their own keys (j/k, x, e, t) in TaskRow.svelte.
 */
import { goto } from "$app/navigation";
import { onMount } from "svelte";
import { quickCaptureKeys } from "./settings.svelte";

/** The shortcuts dialog, opened with "?" or from the sidebar. */
export const helpState = $state({ open: false });

// Open modals, counted by Modal.svelte. Page shortcuts are off while one is open.
let openModals = 0;

export function modalOpened() {
  openModals++;
  return () => {
    openModals--;
  };
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * The key for a shortcut, or null when the press should be left alone: while typing, with
 * Ctrl/Alt/Meta held (browser and system shortcuts), on key repeat, or while a modal is open.
 */
export function plainKey(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.altKey || e.metaKey || e.repeat || openModals > 0 || isTyping(e.target)) return null;
  return e.key;
}

type ShortcutMap = Record<string, () => void>;

// Most recently mounted page last; only the top one gets keys.
const pageShortcuts: ShortcutMap[] = [];

/** Registers a page's keys for as long as the page is mounted. Call it from component setup. */
export function useShortcuts(map: ShortcutMap) {
  onMount(() => {
    pageShortcuts.push(map);
    return () => {
      const i = pageShortcuts.lastIndexOf(map);
      if (i >= 0) pageShortcuts.splice(i, 1);
    };
  });
}

const GO_TO: Record<string, string> = {
  t: "/",
  i: "/inbox",
  d: "/dashboard",
  p: "/projects",
  a: "/tasks",
  c: "/clients",
  s: "/settings",
};

// "g" was pressed and is waiting for its second key.
let goPending = false;
let goTimer: ReturnType<typeof setTimeout> | undefined;

export function handleGlobalKey(e: KeyboardEvent) {
  if (e.defaultPrevented) return; // already handled, e.g. by a focused task row
  const key = plainKey(e);
  if (key === null) return;

  if (goPending) {
    goPending = false;
    clearTimeout(goTimer);
    const path = GO_TO[key.toLowerCase()];
    if (path) {
      e.preventDefault();
      goto(path);
    }
    return;
  }

  if (key === "g") {
    goPending = true;
    goTimer = setTimeout(() => (goPending = false), 1500);
    e.preventDefault();
    return;
  }

  if (key === "?") {
    e.preventDefault();
    helpState.open = true;
    return;
  }

  if (key === "j") {
    const first = document.querySelector<HTMLElement>("[data-task-row]");
    if (first) {
      e.preventDefault();
      first.focus();
    }
    return;
  }

  const action = pageShortcuts.at(-1)?.[key];
  if (action) {
    e.preventDefault();
    action();
  }
}

/** One shortcut for the help dialog. keys: alternatives, each a sequence of keys ("G", "T"). */
export interface ShortcutInfo {
  keys: string[][];
  label: string;
}

/** Every shortcut, by group. A function because the quick capture keys can be changed in Settings. */
export const shortcutGroups = (): { title: string; items: ShortcutInfo[] }[] => [
  {
    title: "Go to",
    items: [
      { keys: [["G", "T"]], label: "Today" },
      { keys: [["G", "I"]], label: "Inbox" },
      { keys: [["G", "D"]], label: "Dashboard" },
      { keys: [["G", "P"]], label: "Projects" },
      { keys: [["G", "A"]], label: "All tasks" },
      { keys: [["G", "C"]], label: "Clients" },
      { keys: [["G", "S"]], label: "Settings" },
    ],
  },
  {
    title: "Anywhere",
    items: [
      { keys: [quickCaptureKeys().split("+")], label: "Quick capture to Inbox (even when the app is hidden)" },
      { keys: [["?"]], label: "Show keyboard shortcuts" },
      { keys: [["N"]], label: "New task / project / client / inbox item (on its page)" },
      { keys: [["J"]], label: "Focus the first task" },
    ],
  },
  {
    title: "Focused task",
    items: [
      { keys: [["J"], ["↓"]], label: "Next task" },
      { keys: [["K"], ["↑"]], label: "Previous task" },
      { keys: [["X"], ["Space"]], label: "Mark done / not done" },
      { keys: [["Enter"], ["E"]], label: "Edit" },
      { keys: [["T"]], label: "Add to / remove from Today" },
    ],
  },
  {
    title: "Today",
    items: [{ keys: [["P"]], label: "Pick today's tasks" }],
  },
  {
    title: "Project page",
    items: [
      { keys: [["M"]], label: "New milestone" },
      { keys: [["E"]], label: "Edit project" },
      { keys: [["O"]], label: "Open the project folder" },
      { keys: [["V"]], label: "Open the project folder in VS Code" },
      { keys: [["1"], ["2"], ["3"], ["4"]], label: "Overview / Tasks / Milestones / Info" },
      { keys: [["B"]], label: "Switch tasks between list and board" },
    ],
  },
  {
    title: "Board card",
    items: [
      { keys: [["←"], ["→"]], label: "Move to the previous / next column" },
      { keys: [["Enter"]], label: "Edit" },
    ],
  },
  {
    title: "Forms",
    items: [
      { keys: [["Ctrl", "Enter"]], label: "Save (also inside text areas)" },
      { keys: [["Esc"]], label: "Close" },
    ],
  },
];
