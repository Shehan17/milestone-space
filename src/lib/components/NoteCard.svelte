<!--
  One note on a NoteBoard: title, markdown body (long notes are cut off with a fade) and, on hover or
  focus, pin and delete. A button covers the whole card: click opens the note, drag moves it. Links and
  "- [ ]" checkboxes in the body sit above that button and work on their own.
-->
<script lang="ts">
  import { openMarkdownLink, renderMarkdown } from "$lib/markdown";
  import type { Note } from "$lib/types";
  import Icon from "./Icon.svelte";

  interface Props {
    note: Note;
    /** The card being dragged: shown faded where it would land. */
    dragging?: boolean;
    onopen: () => void;
    onpin: () => void;
    ondelete: () => void;
    /** A checkbox in the body was clicked: the index-th "- [ ]" item. */
    oncheck: (index: number) => void;
    ondragstart: (event: DragEvent) => void;
    ondragend: () => void;
    onkeydown: (event: KeyboardEvent) => void;
  }

  let { note, dragging = false, onopen, onpin, ondelete, oncheck, ondragstart, ondragend, onkeydown }: Props = $props();

  let html = $derived(note.content.trim() ? renderMarkdown(note.content, { checkboxes: true }) : "");

  /** Markdown at the start of a line: "## ", "- ", "> ", "1. ", "- [ ] "... */
  const LINE_MARKS = /^(?:\s*(?:[#>*+-]+|\d+[.)])\s*)*(?:\[[ xX]\]\s*)?/;

  /** What the card is called for screen readers and tooltips: its title, else its first line. */
  let label = $derived(note.title.trim() || note.content.trim().split("\n")[0].replace(LINE_MARKS, "") || "Empty note");

  function onBodyClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      event.preventDefault(); // the board saves the change and re-renders the box
      const boxes = [...(event.currentTarget as HTMLElement).querySelectorAll('input[type="checkbox"]')];
      oncheck(boxes.indexOf(target));
      return;
    }
    openMarkdownLink(event);
  }

  /** Shown on hover or keyboard focus only. */
  const onHover = "opacity-0 group-hover:opacity-100 group-has-focus-visible:opacity-100 focus-within:opacity-100";

  /** Long notes stop at a fixed height and fade out; open the note to read the rest. */
  let clipped = $state(false);

  function watchClip(body: HTMLElement) {
    void html; // checks again when the text changes (an attachment re-runs when what it reads changes)
    const check = () => (clipped = body.scrollHeight > body.clientHeight + 1);
    const observer = new ResizeObserver(check);
    observer.observe(body);
    check();
    return () => observer.disconnect();
  }
</script>

<article
  class="note-card group {dragging ? 'opacity-40' : ''}"
  data-tint={note.color ? "" : undefined}
  style:--tint={note.color}
>
  <button
    type="button"
    draggable="true"
    class="absolute inset-0 cursor-pointer rounded-card active:cursor-grabbing"
    aria-label={label}
    title="Click to open · drag or ←/→ to move · P pin · Delete delete"
    onclick={onopen}
    {ondragstart}
    {ondragend}
    {onkeydown}
  ></button>

  <div class="pointer-events-none relative px-4 pt-3.5 pb-4 {note.pinned_at ? 'pr-10' : ''}">
    {#if note.title.trim()}
      <p class="text-[0.9375rem] leading-snug font-semibold break-words text-strong">{note.title}</p>
    {/if}
    {#if html}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
        {@attach watchClip}
        class="markdown note-body max-h-80 overflow-hidden break-words [&_a]:pointer-events-auto [&_input]:pointer-events-auto [&_input]:cursor-pointer
          {note.title.trim() ? 'mt-2' : ''} {clipped ? 'note-body-clipped' : ''}"
        onclick={onBodyClick}
      >
        {@html html}
      </div>
    {:else if !note.title.trim()}
      <p class="text-sm text-muted">Empty note</p>
    {/if}
  </div>

  <!-- Each on the card's own color, so it covers the text under it. A pinned note always shows its pin. -->
  <div class="absolute top-1.5 right-1.5 flex gap-0.5">
    <span class="rounded-control bg-(--card-bg) {onHover}">
      <button type="button" class="icon-btn icon-btn-danger" aria-label="Delete note" title="Delete (Delete)" onclick={ondelete}>
        <Icon name="trash" size={15} />
      </button>
    </span>
    <span class="rounded-control bg-(--card-bg) {note.pinned_at ? '' : onHover}">
      <button
        type="button"
        class="icon-btn {note.pinned_at ? 'text-accent-text' : ''}"
        aria-label={note.pinned_at ? "Unpin note" : "Pin note"}
        aria-pressed={!!note.pinned_at}
        title={note.pinned_at ? "Unpin (P)" : "Pin to the top (P)"}
        onclick={onpin}
      >
        <Icon name="pin" size={15} />
      </button>
    </span>
  </div>
</article>
