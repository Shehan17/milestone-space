/**
 * Color themes. Each theme defines the design tokens (--canvas, --surface, --accent...) in app.css
 * under :root[data-theme="..."], so every component recolors without changes.
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
  /** Fixed colors for the preview swatch on the settings page (the theme's own tokens). */
  preview: { bg: string; card: string; border: string; text: string; muted: string; accent: string };
}

export const THEMES: Theme[] = [
  {
    id: "midnight",
    name: "Midnight",
    mode: "dark",
    description: "Near-black with an indigo accent. The default.",
    preview: { bg: "#0f0f12", card: "#16161a", border: "#26262d", text: "#f2f2f5", muted: "#8b8b96", accent: "#5560d8" },
  },
  {
    id: "ocean",
    name: "Deep Ocean",
    mode: "dark",
    description: "Muted blue slate with a sky-blue accent.",
    preview: { bg: "#141b26", card: "#1a2330", border: "#2a3546", text: "#e6ebf1", muted: "#8593a7", accent: "#2a74a3" },
  },
  {
    id: "light",
    name: "Daylight",
    mode: "light",
    description: "Soft gray, easy on the eyes, with a violet accent.",
    preview: { bg: "#e4e4e9", card: "#eeeef2", border: "#d2d2d9", text: "#1c1c22", muted: "#5e5e68", accent: "#6849c4" },
  },
  {
    id: "sand",
    name: "Sand",
    mode: "light",
    description: "Warm paper tones with a teal accent.",
    preview: { bg: "#e6dfd3", card: "#efe9df", border: "#d3c9bb", text: "#24201b", muted: "#5f574d", accent: "#1a655e" },
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

/** --accent-text-strong, --accent-text, --accent-hover, --accent (see app.css). */
type Shades = [string, string, string, string];

export interface Accent {
  id: Exclude<AccentId, "theme">;
  name: string;
  /** Dark themes: light text shades first; the last one is the button color (white text on it passes AA). */
  dark: Shades;
  /** Light themes: dark text shades first; the last one is the button color. */
  light: Shades;
}

// Every shade is checked for WCAG AA: text shades on all theme surfaces, white text on the button color.
export const ACCENTS: Accent[] = [
  { id: "indigo", name: "Indigo", dark: ["#c3c8fa", "#a0a8f5", "#6a74e6", "#5560d8"], light: ["#3a43a8", "#4651c2", "#5a65d6", "#4651c2"] },
  { id: "violet", name: "Violet", dark: ["#c4b8f5", "#a993f0", "#8f73e6", "#7458d0"], light: ["#5b3fb0", "#6849c4", "#7a5ad6", "#6849c4"] },
  { id: "blue", name: "Blue", dark: ["#a9cbf7", "#7fb0f0", "#4f8ee0", "#2f6fc4"], light: ["#1f4f99", "#2459a8", "#3a78cf", "#2459a8"] },
  { id: "teal", name: "Teal", dark: ["#9edfd6", "#6cc9bd", "#2f9a8e", "#227a71"], light: ["#15524c", "#1a655e", "#227a71", "#1a655e"] },
  { id: "emerald", name: "Emerald", dark: ["#a6e3c4", "#74cfa2", "#2f9466", "#237a52"], light: ["#1d5e44", "#1f6847", "#2b8a5f", "#1f6847"] },
  { id: "rose", name: "Rose", dark: ["#f5b8c6", "#ee90a6", "#d9587a", "#c23e5f"], light: ["#9c2a45", "#a52e4a", "#c94562", "#a52e4a"] },
  { id: "amber", name: "Amber", dark: ["#f3d29b", "#ebbb6a", "#b0761c", "#946013"], light: ["#7a4a0c", "#85500c", "#ad6a12", "#85500c"] },
];

const ACCENT_VARS = ["--accent-text-strong", "--accent-text", "--accent-hover", "--accent"];

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
