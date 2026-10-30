import DOMPurify from "dompurify";
import { marked } from "marked";
import { openUrl } from "@tauri-apps/plugin-opener";

/**
 * Markdown to safe HTML (GitHub style, single line breaks kept). With `checkboxes`, "- [ ]" task
 * list boxes stay clickable instead of disabled; pass the click to toggleTaskItem().
 */
export function renderMarkdown(text: string, { checkboxes = false } = {}): string {
  const html = DOMPurify.sanitize(marked.parse(text, { async: false, gfm: true, breaks: true }));
  return checkboxes ? html.replace(/(<input[^>]*?) disabled=""/g, "$1") : html;
}

/** "- [ ] " / "1. [x] " list items, in the order marked renders their checkboxes. */
const TASK_ITEM = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/gm;

/** Ticks or unticks the index-th task list item in the markdown text. */
export function toggleTaskItem(text: string, index: number): string {
  let i = 0;
  return text.replace(TASK_ITEM, (match, start: string, mark: string, end: string) =>
    i++ === index ? `${start}${mark === " " ? "x" : " "}${end}` : match
  );
}

/**
 * Links in rendered markdown open in the default browser instead of navigating the app.
 * Returns true when the click was on a link.
 */
export function openMarkdownLink(event: MouseEvent): boolean {
  const link = (event.target as HTMLElement).closest("a");
  if (!link) return false;
  event.preventDefault();
  const href = link.getAttribute("href") ?? "";
  if (/^(https?:|mailto:)/i.test(href)) openUrl(href);
  return true;
}
