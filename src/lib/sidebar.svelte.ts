/**
 * The sidebar can shrink to an icon rail: with the toggle at its bottom or "[" (a display
 * preference, so localStorage), and always in narrow windows so the page keeps its room.
 */
const STORAGE_KEY = "milestonespace.sidebarCollapsed";
const NARROW = "(max-width: 959px)";

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

const narrowQuery = typeof window === "undefined" ? null : window.matchMedia(NARROW);

export const sidebar = $state({ chosenCollapsed: read(), narrow: narrowQuery?.matches ?? false });

narrowQuery?.addEventListener("change", (e) => (sidebar.narrow = e.matches));

export function isSidebarCollapsed(): boolean {
  return sidebar.chosenCollapsed || sidebar.narrow;
}

export function toggleSidebar() {
  if (sidebar.narrow) return; // no room for the full sidebar
  sidebar.chosenCollapsed = !sidebar.chosenCollapsed;
  try {
    localStorage.setItem(STORAGE_KEY, sidebar.chosenCollapsed ? "1" : "0");
  } catch {
    // Still applied until the app restarts.
  }
}
