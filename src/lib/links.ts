/** Project links: web addresses and Windows folders (ProjectLinks.svelte, LinkForm.svelte). */

/** A Windows path like "G:\My Drive\designs" or "\\server\share". */
export const isLocalPath = (url: string) => /^[a-z]:[\\/]|^\\\\/i.test(url.trim());

/** "github.com/me/repo" → "https://github.com/me/repo", so the opener accepts it. Paths stay as they are. */
export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  if (isLocalPath(trimmed) || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Why the link can't be opened, or null when it's fine. */
export function linkError(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return "Add a web address or a folder path";
  if (isLocalPath(trimmed)) return null;
  try {
    const parsed = new URL(normalizeUrl(trimmed));
    if (/^https?:$/.test(parsed.protocol) && !parsed.hostname.includes(".") && parsed.hostname !== "localhost") {
      return "That doesn't look like a web address (e.g. github.com/you/repo)";
    }
    return null;
  } catch {
    return "That doesn't look like a web address (e.g. github.com/you/repo)";
  }
}
