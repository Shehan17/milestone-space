<script lang="ts">
  import { tick, untrack } from "svelte";
  import { marked } from "marked";
  import DOMPurify from "dompurify";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { getProjectNote, saveProjectNote } from "$lib/db";
  import Icon from "./Icon.svelte";
  import Tabs from "./Tabs.svelte";

  let { projectId }: { projectId: number } = $props();

  let content = $state("");
  let loaded = $state(false);
  let mode = $state<"edit" | "preview">("edit");
  let status = $state<"idle" | "saving" | "saved">("idle");
  let textarea = $state<HTMLTextAreaElement>();

  // Not reactive: the project the current content belongs to, and whether it has unsaved edits.
  let noteProjectId = 0;
  let dirty = false;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  async function load(id: number) {
    noteProjectId = id;
    loaded = false;
    status = "idle";
    const note = await getProjectNote(id);
    content = note?.content ?? "";
    loaded = true;
    // Written notes open for reading; an empty note opens ready to type.
    mode = content.trim() ? "preview" : "edit";
  }

  async function save() {
    clearTimeout(saveTimer);
    if (!dirty) return;
    dirty = false;
    status = "saving";
    await saveProjectNote(noteProjectId, content);
    if (!dirty) status = "saved";
  }

  /** Auto-save about one second after typing stops. */
  function oninput() {
    dirty = true;
    status = "idle";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 1000);
  }

  async function startEditing() {
    mode = "edit";
    await tick();
    textarea?.focus();
  }

  // Load on mount and when the project changes; save any pending edits on the way out.
  $effect(() => {
    const id = projectId;
    untrack(() => load(id));
    return () => {
      save();
    };
  });

  // Closing the app within a second of typing would skip the auto-save, so save first.
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

  let html = $derived(
    mode === "preview" ? DOMPurify.sanitize(marked.parse(content, { async: false, gfm: true, breaks: true })) : ""
  );

  /** Links in the preview open in the default browser instead of navigating the app. */
  function onPreviewClick(event: MouseEvent) {
    const link = (event.target as HTMLElement).closest("a");
    if (!link) return;
    event.preventDefault();
    const href = link.getAttribute("href") ?? "";
    if (/^(https?:|mailto:)/i.test(href)) openUrl(href);
  }
</script>

<section class="card transition-colors duration-150 focus-within:border-line-strong">
  <div class="card-header">
    <h2 class="card-title">Notes</h2>
    <div class="flex items-center gap-3">
      <span class="flex items-center gap-1 text-xs text-faint" aria-live="polite">
        {#if status === "saving"}Saving…{:else if status === "saved"}<Icon name="check" size={12} />Saved{/if}
      </span>
      <Tabs
        options={[
          { value: "edit", label: "Edit" },
          { value: "preview", label: "Preview" },
        ]}
        bind:value={mode}
        onchange={save}
        label="Notes view"
      />
    </div>
  </div>
  {#if mode === "edit"}
    <textarea
      bind:this={textarea}
      class="block min-h-64 w-full resize-y bg-transparent px-5 py-4 font-mono text-sm text-fg placeholder:text-faint focus:outline-none"
      placeholder={loaded ? "Write notes in Markdown: # headings, - lists, **bold**, [links](https://…)" : "Loading…"}
      aria-label="Project notes"
      disabled={!loaded}
      bind:value={content}
      {oninput}
      onblur={save}
    ></textarea>
  {:else if content.trim()}
    <!-- Double-click the text to edit it. -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="markdown min-h-64 px-5 py-4" onclick={onPreviewClick} ondblclick={startEditing} title="Double-click to edit">
      {@html html}
    </div>
  {:else}
    <div class="min-h-64 px-5 py-4">
      <button type="button" class="link text-sm" onclick={startEditing}>Nothing here yet. Write the first note</button>
    </div>
  {/if}
</section>
