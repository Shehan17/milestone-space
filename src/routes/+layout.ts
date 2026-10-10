// Tauri doesn't have a Node.js server to do proper SSR
// so we use adapter-static with a fallback to index.html to put the site in SPA mode
// See: https://svelte.dev/docs/kit/single-page-apps
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
import { redirect } from "@sveltejs/kit";
import { loadSettings, settings } from "$lib/settings.svelte";
import type { LayoutLoad } from "./$types";

export const ssr = false;

let started = false;

// Runs before the first page renders, so dates, spacing and colors are right from the start.
export const load: LayoutLoad = async ({ url }) => {
  if (started) return;
  started = true;
  await loadSettings();
  // The app opens on "/" (Today); the Settings page can pick another start page.
  if (url.pathname === "/" && settings.start_page !== "/") redirect(307, settings.start_page);
};
