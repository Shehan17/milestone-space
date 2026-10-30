// Images come straight from the app repo (docs/screenshots, the app icon), so updating a README
// screenshot updates the site too. Vite copies and hashes them at build time.

const screenshotFiles = import.meta.glob<string>("../../../docs/screenshots/*.{png,jpg}", {
  eager: true,
  query: "?url",
  import: "default",
});

/** Screenshot URLs by file name without the extension: `screenshots.today`, `screenshots.board`... */
export const screenshots: Record<string, string> = Object.fromEntries(
  Object.entries(screenshotFiles).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, ""), url]),
);

export { default as appIcon } from "../../../src-tauri/icons/128x128@2x.png";
