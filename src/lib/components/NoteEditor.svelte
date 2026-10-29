<!--
  Opens one note (or a new one) in a dialog. There is no Save button: changes are saved a moment
  after typing stops and when the dialog closes. A new note is only created once it has some text,
  so opening New note and closing it again leaves nothing behind.
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { addNote, updateNote } from "$lib/db";
  import { PROJECT_COLORS, type Note, type NoteInput, type NoteOwner } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";

  interface Props {
    open: boolean;
    owner: NoteOwner;
    /** The note to edit, or null for a new one. */
    note: Note | null;
    /** After every save, so the board behind the dialog shows the change. */
    onsaved: () => void;
    onclose: () => void;
    /** Delete (with Undo) an existing note; the dialog has already saved and closed. */
    ondelete: (id: number) => void;
  }

  let { open, owner, note, onsaved, onclose, ondelete }: Props = $props();

  let draft = $state<NoteInput>({ title: "", content: "", color: null });
  /** The saved note: set once a new note has been created. */
  let noteId = $state<number | null>(null);
  let status = $state<"idle" | "saving" | "saved">("idle");
  let textarea = $state<HTMLTextAreaElement>();

  // Not reactive: unsaved edits, the pending auto-save, and the save running now.
  let dirty = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let saving: Promise<void> = Promise.resolve();

  // A fresh draft each time the dialog opens.
  $effect(() => {
    if (!open) return;
    untrack(() => {
      draft = note ? { title: note.title, content: note.content, color: note.color } : { title: "", content: "", color: null };
      noteId = note?.id ?? null;
      status = "idle";
      dirty = false;
    });
  });

  const isEmpty = (input: NoteInput) => !input.title.trim() && !input.content.trim();

  /** Saves pending edits. Saves run one after another, so a new note is never added twice. */
  function save(): Promise<void> {
    clearTimeout(saveTimer);
    saving = saving.then(async () => {
      if (!dirty) return;
      dirty = false;
      const values = { ...draft };
      if (noteId === null && isEmpty(values)) return;
      status = "saving";
      if (noteId === null) noteId = await addNote(owner, values);
      else await updateNote(noteId, values);
      if (!dirty) status = "saved";
      onsaved();
    });
    return saving;
  }

  /** Auto-save shortly after typing stops. */
  function changed() {
    dirty = true;
    status = "idle";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 700);
  }

  function setColor(color: string | null) {
    draft.color = color;
    changed();
  }

  async function close() {
    await save();
    onclose();
  }

  async function remove() {
    await save();
    const id = noteId;
    onclose();
    if (id !== null) ondelete(id);
  }

  /** Enter in the title goes on to the text; Ctrl+Enter anywhere closes (the Modal only does that with a Save button). */
  function onTitleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.ctrlKey && !event.shiftKey) {
      event.preventDefault();
      textarea?.focus();
    }
  }

  function onTextKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      close();
    }
  }

  // Closing the app within a moment of typing would skip the auto-save, so save first.
  // The window closes after this handler finishes, even if saving fails.
  $effect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async () => {
      try {
        await save();
      } catch {
        // Never block closing the app.
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  });
</script>

<Modal
  {open}
  size="lg"
  title={note ? "Note" : "New note"}
  onclose={close}
  ondelete={noteId === null ? undefined : remove}
  deleteLabel="Delete note"
>
  {#snippet aside()}
    <span class="flex items-center gap-1" aria-live="polite">
      {#if status === "saving"}Saving…{:else if status === "saved"}<Icon name="check" size={12} />Saved{/if}
    </span>
  {/snippet}

  <input
    class="w-full bg-transparent text-base font-semibold text-strong placeholder:text-faint focus:outline-none"
    placeholder="Title"
    aria-label="Title"
    bind:value={draft.title}
    oninput={changed}
    onkeydown={onTitleKeydown}
    data-autofocus={note ? undefined : ""}
  />
  <textarea
    bind:this={textarea}
    class="block min-h-64 w-full resize-y bg-transparent text-sm leading-relaxed text-fg placeholder:text-faint focus:outline-none"
    placeholder={"Write a note… Markdown works: # heading, - list, **bold**, [link](https://…)\n- [ ] a line like this becomes a checkbox"}
    aria-label="Note"
    bind:value={draft.content}
    oninput={changed}
    onkeydown={onTextKeydown}
    data-autofocus={note ? "" : undefined}
  ></textarea>

  <div role="group" aria-label="Card color" class="flex flex-wrap items-center gap-2 border-t border-line pt-4">
    <span class="mr-2 text-xs font-medium text-muted">Color</span>
    <button
      type="button"
      class="grid size-6 cursor-pointer place-items-center rounded-full border border-line-strong bg-surface ring-offset-2 ring-offset-raised transition-shadow duration-150 {draft.color ===
      null
        ? 'ring-2 ring-strong'
        : 'hover:ring-2 hover:ring-line-strong'}"
      aria-label="No color"
      title="No color"
      aria-pressed={draft.color === null}
      onclick={() => setColor(null)}
    ></button>
    {#each PROJECT_COLORS as color (color)}
      <button
        type="button"
        class="size-6 cursor-pointer rounded-full ring-offset-2 ring-offset-raised transition-shadow duration-150 {draft.color === color
          ? 'ring-2 ring-strong'
          : 'hover:ring-2 hover:ring-line-strong'}"
        style="background-color: {color}"
        aria-label="Color {color}"
        aria-pressed={draft.color === color}
        onclick={() => setColor(color)}
      ></button>
    {/each}
  </div>
</Modal>
