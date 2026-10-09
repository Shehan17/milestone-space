/**
 * Color themes. Each theme redefines Tailwind's zinc / violet (and status color) variables in
 * app.css under :root[data-theme="..."], so the existing classes recolor without changes.
 *
 * The choice is a display preference, so it lives in localStorage, not the database.
 * app.html applies it before the first paint so the app never flashes the wrong theme.
 */

export type ThemeId = "midnight" | "ocean" | "light" | "sand";

export interface Theme {
  id: ThemeId;
  name: string;
  mode: "dark" | "light";
  description: string;
  /** Fixed colors for the preview swatch on the settings page. */
  preview: { bg: string; card: string; border: string; text: string; muted: string; accent: string };
}

export const THEMES: Theme[] = [
  {
    id: "midnight",
    name: "Midnight",
    mode: "dark",
    description: "Soft charcoal with a violet accent. The default.",
    preview: { bg: "#18181c", card: "#222228", border: "#2f2f36", text: "#e4e4e9", muted: "#7c7c87", accent: "#8f73e6" },
  },
  {
    id: "ocean",
    name: "Deep Ocean",
    mode: "dark",
    description: "Muted blue slate with a soft sky-blue accent.",
    preview: { bg: "#161e2a", card: "#1e2836", border: "#2a3546", text: "#dfe5ec", muted: "#728196", accent: "#4ea3d2" },
  },
  {
    id: "light",
    name: "Daylight",
    mode: "light",
    description: "Soft gray, easy on the eyes, with a violet accent.",
    preview: { bg: "#e2e2e7", card: "#ececf0", border: "#d3d3da", text: "#202026", muted: "#6c6c76", accent: "#6849c4" },
  },
  {
    id: "sand",
    name: "Sand",
    mode: "light",
    description: "Warm paper tones with a teal accent.",
    preview: { bg: "#e6dfd3", card: "#efe9df", border: "#d8cfc2", text: "#24201b", muted: "#746b60", accent: "#1a655e" },
  },
];

export const DEFAULT_THEME: ThemeId = "midnight";

/** Must match the key read by the inline script in app.html. */
const STORAGE_KEY = "milestonespace.theme";

function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function getTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemeId(stored)) return stored;
  } catch {
    // Storage unavailable: fall back to the default.
  }
  return DEFAULT_THEME;
}

export function setTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Still applied for this session.
  }
}
