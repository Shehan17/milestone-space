/**
 * Small messages in the bottom-right corner: "Task added", "Saved", "Task deleted · Undo".
 * Toaster.svelte (in +layout.svelte) shows them. Messages close by themselves after a few
 * seconds (hovering pauses that); errors stay until closed.
 */

export type ToastKind = "success" | "info" | "error";

export interface ToastAction {
  label: string;
  run: () => unknown;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  detail?: string;
  action?: ToastAction;
  /** Milliseconds before it closes by itself; 0 = stays until closed. */
  duration: number;
  /** The action is an undo: Ctrl+Z runs it too. */
  undo: boolean;
}

interface Options {
  detail?: string;
  action?: ToastAction;
  duration?: number;
}

export const toasts = $state<Toast[]>([]);

const MAX_TOASTS = 4;
let nextId = 1;

function show(kind: ToastKind, message: string, options: Options = {}, undo = false): number {
  const id = nextId++;
  const duration = options.duration ?? (kind === "error" ? 0 : options.action ? 6000 : 3000);
  toasts.push({ id, kind, message, detail: options.detail, action: options.action, duration, undo });
  if (toasts.length > MAX_TOASTS) toasts.splice(0, toasts.length - MAX_TOASTS);
  return id;
}

/** A readable message from anything thrown. */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const toast = {
  success: (message: string, options?: Options) => show("success", message, options),
  info: (message: string, options?: Options) => show("info", message, options),
  /** Stays until closed. `error` (optional) is shown in small print under the message. */
  error: (message: string, error?: unknown) =>
    show("error", message, { detail: error === undefined ? undefined : errorText(error) }),
  /** "Task deleted" with an Undo button (Ctrl+Z works too). `undo` puts things back and reloads. */
  undo: (message: string, undo: () => unknown) => show("info", message, { action: { label: "Undo", run: undo } }, true),
};

export function dismissToast(id: number) {
  const i = toasts.findIndex((t) => t.id === id);
  if (i >= 0) toasts.splice(i, 1);
}

/** Runs a toast's button once and closes the toast. A failure becomes an error toast. */
export async function runToastAction(t: Toast) {
  dismissToast(t.id);
  try {
    await t.action?.run();
  } catch (e) {
    toast.error(t.undo ? "Couldn't undo that" : `${t.action?.label} didn't work`, e);
  }
}

/** Ctrl+Z: undoes the newest action that still shows an Undo button. False when there is none. */
export function undoLatest(): boolean {
  for (let i = toasts.length - 1; i >= 0; i--) {
    if (toasts[i].undo) {
      runToastAction(toasts[i]);
      return true;
    }
  }
  return false;
}
