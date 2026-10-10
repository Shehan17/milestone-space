/**
 * Color themes. Each theme redefines Tailwind's zinc / violet (and status color) variables in
 * app.css under :root[data-theme="..."], so the existing classes recolor without changes.
 *
 * The choice is a display preference, so it lives in localStorage, not the database.
 * app.html applies it before the first paint so the app never flashes the wrong theme.
 */
import type { AccentId, Density, FontSize, Settings } from "./settings.svelte";

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

// ---------- Accent color, spacing and text size (saved with the other settings) ----------

type Shades = [string, string, string, string]; // violet-300, -400, -500, -600

export interface Accent {
  id: Exclude<AccentId, "theme">;
  name: string;
  /** Dark themes: 300 is the lightest (text on dark), 600 the button color. */
  dark: Shades;
  /** Light themes run the other way: 300 is the darkest (text on light). */
  light: Shades;
}

export const ACCENTS: Accent[] = [
  { id: "violet", name: "Violet", dark: ["#c4b8f5", "#a993f0", "#8f73e6", "#7458d0"], light: ["#5b3fb0", "#6849c4", "#7a5ad6", "#6849c4"] },
  { id: "indigo", name: "Indigo", dark: ["#b4bcf7", "#959ff2", "#7582ea", "#5864d6"], light: ["#3a43a8", "#4651c2", "#5a65d6", "#4651c2"] },
  { id: "blue", name: "Blue", dark: ["#a9cbf7", "#7fb0f0", "#5b95e6", "#3e78cc"], light: ["#1f4f99", "#2a63b8", "#3a78cf", "#2a63b8"] },
  { id: "teal", name: "Teal", dark: ["#9edfd6", "#6cc9bd", "#46b0a3", "#2f8f84"], light: ["#15524c", "#1a655e", "#227a71", "#1a655e"] },
  { id: "emerald", name: "Emerald", dark: ["#a6e3c4", "#74cfa2", "#4cb684", "#33966a"], light: ["#1d5e44", "#23744f", "#2b8a5f", "#23744f"] },
  { id: "rose", name: "Rose", dark: ["#f5b8c6", "#ee90a6", "#e26c88", "#c94f6c"], light: ["#9c2a45", "#b53352", "#c94562", "#b53352"] },
  { id: "amber", name: "Amber", dark: ["#f3d29b", "#ebbb6a", "#dea145", "#b97f22"], light: ["#7a4a0c", "#94590e", "#ad6a12", "#94590e"] },
];

const ACCENT_VARS = ["--color-violet-300", "--color-violet-400", "--color-violet-500", "--color-violet-600"];

/** Tailwind sizes every padding, gap and width from --spacing (0.25rem by default). */
const SPACING: Record<Density, string> = { compact: "0.25rem", comfortable: "0.2875rem" };

/** The root font size; text and spacing are in rem, so this scales the whole interface. */
const FONT_SIZES: Record<FontSize, string> = { small: "14px", default: "16px", large: "17px", larger: "18px" };

/**
 * Applies the accent, spacing and text size as inline styles on <html>, which win over the theme
 * rules in app.css. "Theme default" removes the accent so the theme's own accent shows.
 */
export function applyAppearance(s: Pick<Settings, "accent" | "density" | "font_size">) {
  const root = document.documentElement.style;
  const accent = ACCENTS.find((a) => a.id === s.accent);
  const mode = THEMES.find((t) => t.id === getTheme())?.mode ?? "dark";
  ACCENT_VARS.forEach((name, i) => {
    if (accent) root.setProperty(name, accent[mode][i]);
    else root.removeProperty(name);
  });
  root.setProperty("--spacing", SPACING[s.density] ?? SPACING.compact);
  root.fontSize = FONT_SIZES[s.font_size] ?? FONT_SIZES.default;
}
