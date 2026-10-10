/**
 * Inbox count for the sidebar badge, and the event that keeps windows in sync: the quick capture
 * window (route /quick) is a separate window, so it tells the main window when it saves.
 */
import { emit, listen } from "@tauri-apps/api/event";
import { countInboxItems } from "./db";

const INBOX_CHANGED = "inbox-changed";

export const inbox = $state({ count: 0 });

export async function refreshInboxCount() {
  inbox.count = await countInboxItems();
}

/** Tells every window that inbox items were added or removed. */
export function notifyInboxChanged() {
  return emit(INBOX_CHANGED);
}

/** Calls fn whenever any window changes the inbox. Returns the cleanup function for onMount. */
export function onInboxChanged(fn: () => void) {
  const unlisten = listen(INBOX_CHANGED, fn);
  return () => {
    unlisten.then((stop) => stop());
  };
}
