<!--
  Keep-style note cards for a project or a client: pinned notes on top, then the others, each group in
  a masonry grid (every card goes into the shortest column, so the order reads left to right).
  Drag a card onto another to move it there (native HTML5 drag events; the others make room while
  dragging). Keyboard: on a focused card ←/→ moves it, P pins, Delete deletes (with Undo), Enter opens.
-->
<script lang="ts">
  import { tick, untrack } from "svelte";
  import { deleteNote, getNotes, reorderNotes, setNotePinned, updateNote } from "$lib/db";
  import { toggleTaskItem } from "$lib/markdown";
  import { ms } from "$lib/motion";
  import { plainKey } from "$lib/shortcuts.svelte";
  import { toast } from "$lib/toast.svelte";
  import type { Note, NoteOwner } from "$lib/types";
  import EmptyState from "./EmptyState.svelte";
  import Icon from "./Icon.svelte";
  import NoteCard from "./NoteCard.svelte";
  import NoteEditor from "./NoteEditor.svelte";
  import Skeleton from "./Skeleton.svelte";

  let { owner }: { owner: NoteOwner } = $props();

  const uid = $props.id();

  let notes = $state<Note[]>([]);
  let loaded = $state(false);

  async function load() {
    notes = await getNotes(owner);
    loaded = true;
  }

  // Load again when the board is moved to another project or client.
  $effect(() => {
    void owner.type;
    void owner.id;
    untrack(() => {
      loaded = false;
      load();
    });
  });

  type Group = "pinned" | "others";
  const groupOf = (note: Note): Group => (note.pinned_at ? "pinned" : "others");
  let groups = $derived({
    pinned: notes.filter((n) => n.pinned_at),
    others: notes.filter((n) => !n.pinned_at),
  });

  // ----- Masonry layout: cards are placed absolutely, so they slide (not jump) when the order changes -----
  const GAP = 14;
  const MIN_CARD = 220;
  let width = $state(0);
  /** Measured card heights, by note id. */
  let heights = $state<Record<number, number>>({});

  let columns = $derived(Math.max(1, Math.floor((width + GAP) / (MIN_CARD + GAP))));
  let cardWidth = $derived(Math.max(0, (width - GAP * (columns - 1)) / columns));

  function layout(list: Note[]) {
    const tops = Array<number>(columns).fill(0);
    const positions = new Map<number, { x: number; y: number }>();
    for (const note of list) {
      const column = tops.indexOf(Math.min(...tops));
      positions.set(note.id, { x: column * (cardWidth + GAP), y: tops[column] });
      tops[column] += (heights[note.id] ?? 120) + GAP;
    }
    return { positions, height: Math.max(0, ...tops.map((t) => t - GAP)) };
  }

  /** Cards slide to their new place only while they're being arranged (not on load or when one is added). */
  let sliding = $state(false);
  let slidingTimer: ReturnType<typeof setTimeout> | undefined;

  function slideFor(duration: number) {
    sliding = true;
    clearTimeout(slidingTimer);
    slidingTimer = setTimeout(() => (sliding = false), duration);
  }

  // ----- Drag and drop -----
  let dragging = $state<Note | null>(null);
  /** The dragged card, faded where it would land. Set a frame later, so the drag image isn't faded too. */
  let ghostId = $state<number | null>(null);
  /** While dragging: the dragged card's group in the order it would be dropped in. */
  let preview = $state<number[]>([]);
  /** The card last dragged over, so passing over one card moves things once, not on every mouse move. */
  let lastOver: number | null = null;
  /** Cards slide for a moment after each move; ignore what passes under the pointer meanwhile. */
  let settleUntil = 0;

  /** A group's cards in the order shown: the preview order while one of them is dragged. */
  function shown(group: Group): Note[] {
    const list = groups[group];
    if (!dragging || groupOf(dragging) !== group) return list;
    return preview.map((id) => list.find((n) => n.id === id)).filter((n): n is Note => !!n);
  }

  function ondragstart(event: DragEvent, note: Note) {
    dragging = note;
    sliding = true;
    requestAnimationFrame(() => (ghostId = dragging?.id ?? null));
    preview = groups[groupOf(note)].map((n) => n.id);
    lastOver = note.id;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(note.id));
      // The button that starts the drag is an empty layer over the card: show the card itself.
      const card = (event.currentTarget as HTMLElement).closest("article");
      if (card) {
        const rect = card.getBoundingClientRect();
        event.dataTransfer.setDragImage(card, event.clientX - rect.left, event.clientY - rect.top);
      }
    }
  }

  function ondragover(event: DragEvent, group: Group) {
    if (!dragging || groupOf(dragging) !== group) return;
    event.preventDefault(); // allows the drop
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    const over = Number((event.target as HTMLElement).closest<HTMLElement>("[data-note-id]")?.dataset.noteId);
    if (!over || over === lastOver || performance.now() < settleUntil) return;
    lastOver = over;
    if (over === dragging.id) return;
    const from = preview.indexOf(dragging.id);
    const to = preview.indexOf(over);
    if (from < 0 || to < 0) return;
    const next = [...preview];
    next.splice(from, 1);
    next.splice(to, 0, dragging.id);
    preview = next;
    settleUntil = performance.now() + ms(160);
  }

  async function ondrop(event: DragEvent) {
    event.preventDefault();
    if (!dragging) return;
    const note = dragging;
    const order = preview;
    endDrag();
    await saveOrder(groupOf(note), order);
  }

  /** Also when dropped outside the board (or on Esc): the cards slide back. */
  function endDrag() {
    dragging = null;
    ghostId = null;
    slideFor(300);
  }

  /** Shows the new order of a group right away, then saves it. */
  async function saveOrder(group: Group, order: number[]) {
    const before = groups[group].map((n) => n.id);
    if (order.join() === before.join()) return;
    slideFor(300);
    notes = notes.map((n) => (order.includes(n.id) ? { ...n, sort_order: order.indexOf(n.id) } : n));
    notes.sort((a, b) => Number(!a.pinned_at) - Number(!b.pinned_at) || a.sort_order - b.sort_order || a.id - b.id);
    await reorderNotes(order);
    await load();
  }

  // ----- Keyboard on a focused card -----
  async function oncardkeydown(event: KeyboardEvent, note: Note) {
    const key = plainKey(event);
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      const order = groups[groupOf(note)].map((n) => n.id);
      const from = order.indexOf(note.id);
      const to = from + (key === "ArrowLeft" ? -1 : 1);
      if (to < 0 || to >= order.length) return;
      [order[from], order[to]] = [order[to], order[from]];
      await saveOrder(groupOf(note), order);
    } else if (key === "p" || key === "P") {
      event.preventDefault();
      await togglePinned(note);
      await tick();
      focusCard(note.id);
    } else if (key === "Delete") {
      event.preventDefault();
      // Keep the keyboard on the board: focus the next card (or the previous one).
      const i = notes.findIndex((n) => n.id === note.id);
      const neighbour = notes[i + 1] ?? notes[i - 1];
      await remove(note.id);
      await tick();
      if (neighbour) focusCard(neighbour.id);
    }
  }

  function focusCard(id: number) {
    document.querySelector<HTMLElement>(`[data-note-id="${id}"] article > button`)?.focus();
  }

  // ----- Actions -----
  async function togglePinned(note: Note) {
    await setNotePinned(note.id, !note.pinned_at);
    await load();
  }

  /** A ticked checkbox being saved: a delete waits for it, so Undo brings back the ticked note. */
  let saving: Promise<void> | null = null;

  async function remove(id: number) {
    await saving;
    const undo = await deleteNote(id);
    await load();
    toast.undo("Note deleted", async () => {
      await undo();
      await load();
    });
  }

  /** Ticks a "- [ ]" item on the card, shown at once and then saved. */
  async function toggleCheck(note: Note, index: number) {
    const content = toggleTaskItem(note.content, index);
    if (content === note.content) return;
    notes = notes.map((n) => (n.id === note.id ? { ...n, content } : n));
    saving = updateNote(note.id, { title: note.title, content, color: note.color });
    await saving;
    saving = null;
    await load();
  }

  // ----- Editor -----
  let editorOpen = $state(false);
  let editing = $state<Note | null>(null);

  /** Opens a new note. Also called by the page (N on the client page). */
  export function openNew() {
    editing = null;
    editorOpen = true;
  }

  function openNote(note: Note) {
    editing = note;
    editorOpen = true;
  }

  let ownerName = $derived(owner.type === "project" ? "this project" : "this client");
</script>

{#snippet grid(group: Group)}
  {@const list = shown(group)}
  {@const { positions, height } = layout(list)}
  <section
    class="relative"
    style:height="{height}px"
    aria-label={group === "pinned" ? "Pinned notes" : "Notes"}
    ondragover={(e) => ondragover(e, group)}
    {ondrop}
  >
    {#each list as note (note.id)}
      {@const pos = positions.get(note.id)!}
      <div
        data-note-id={note.id}
        class="absolute top-0 left-0"
        style:width="{cardWidth}px"
        style:transform="translate({pos.x}px, {pos.y}px)"
        style:transition={sliding ? `transform ${ms(150)}ms ease` : undefined}
        style:visibility={heights[note.id] === undefined ? "hidden" : undefined}
        bind:offsetHeight={heights[note.id]}
      >
        <NoteCard
          {note}
          dragging={ghostId === note.id}
          onopen={() => openNote(note)}
          onpin={() => togglePinned(note)}
          ondelete={() => remove(note.id)}
          oncheck={(index) => toggleCheck(note, index)}
          ondragstart={(e) => ondragstart(e, note)}
          ondragend={endDrag}
          onkeydown={(e) => oncardkeydown(e, note)}
        />
      </div>
    {/each}
  </section>
{/snippet}

<section aria-labelledby="{uid}-heading">
  <div class="mb-3 flex min-h-8 items-center justify-between gap-3">
    <h2 id="{uid}-heading" class="flex items-center gap-2 text-base font-semibold text-strong">
      Notes {#if notes.length > 0}<span class="count">{notes.length}</span>{/if}
    </h2>
    <button type="button" class="btn btn-secondary btn-sm" onclick={openNew}>
      <Icon name="plus" size={13} />New note
    </button>
  </div>

  {#if !loaded}
    <div class="card"><Skeleton /></div>
  {:else if notes.length === 0}
    <div class="card">
      <EmptyState
        icon="note"
        message="No notes yet"
        hint="Keep anything about {ownerName} on cards: meeting notes, ideas, checklists. Drag them to arrange them."
        action={{ label: "New note", icon: "plus", primary: true, onclick: openNew }}
      />
    </div>
  {:else}
    <div bind:clientWidth={width}>
      {#if groups.pinned.length > 0}
        <p class="eyebrow mb-2">Pinned</p>
        {@render grid("pinned")}
        {#if groups.others.length > 0}<p class="eyebrow mt-5 mb-2">Others</p>{/if}
      {/if}
      {@render grid("others")}
    </div>
  {/if}
</section>

<NoteEditor
  open={editorOpen}
  {owner}
  note={editing}
  onsaved={load}
  onclose={() => (editorOpen = false)}
  ondelete={remove}
/>
