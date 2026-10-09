<script lang="ts">
  import { untrack } from "svelte";
  import { marked } from "marked";
  import DOMPurify from "dompurify";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { getProjectNote, saveProjectNote } from "$lib/db";
  import Tabs from "./Tabs.svelte";

  let { projectId }: { projectId: number } = $props();

  let content = $state("");
  let loaded = $state(false);
  let mode = $state<"edit" | "preview">("edit");
  let status = $state<"idle" | "saving" | "saved">("idle");

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
    if (!content) mode = "edit";
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

<section class="card">
  <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
    <h2 class="text-xs font-semibold text-zinc-300">Notes</h2>
    <div class="flex items-center gap-3">
      <span class="text-xs text-zinc-500">
        {#if status === "saving"}Saving…{:else if status === "saved"}Saved{/if}
      </span>
      <Tabs
        options={[
          { value: "edit", label: "Edit" },
          { value: "preview", label: "Preview" },
        ]}
        bind:value={mode}
        onchange={save}
      />
    </div>
  </div>
  {#if mode === "edit"}
    <textarea
      class="block min-h-64 w-full resize-y bg-transparent px-4 py-3 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
      placeholder={loaded ? "Write notes in markdown…" : "Loading…"}
      disabled={!loaded}
      bind:value={content}
      {oninput}
      onblur={save}
    ></textarea>
  {:else if content.trim()}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="markdown min-h-64 px-4 py-3" onclick={onPreviewClick}>
      {@html html}
    </div>
  {:else}
    <p class="min-h-64 px-4 py-3 text-sm text-zinc-500">Nothing to preview yet.</p>
  {/if}
</section>
