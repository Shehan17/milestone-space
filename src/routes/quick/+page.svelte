<!--
  The quick capture box: its own small window, opened from anywhere with the global shortcut
  (src-tauri/src/lib.rs). Enter saves to the Inbox, shows "Added" for a moment and hides the
  window; Esc or clicking elsewhere hides it and keeps what was typed for next time.
-->
<script lang="ts">
  import { onMount, tick } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Icon from "$lib/components/Icon.svelte";
  import { addInboxItem } from "$lib/db";
  import { notifyInboxChanged } from "$lib/inbox.svelte";
  import { quickCaptureKeys } from "$lib/settings.svelte";

  const appWindow = getCurrentWindow();

  /** How long "Added to Inbox" shows before the window hides. */
  const CONFIRM_MS = 400;

  let text = $state("");
  let error = $state("");
  let added = $state(false);
  let input = $state<HTMLInputElement>();
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    input?.focus();
    // Shown again: focus the box. Lost focus (clicked elsewhere): get out of the way.
    const unlisten = appWindow.onFocusChanged(async ({ payload: focused }) => {
      if (focused) {
        clearTimeout(hideTimer);
        added = false;
        await tick(); // the field is back on screen
        input?.focus();
      } else {
        appWindow.hide();
      }
    });
    return () => {
      clearTimeout(hideTimer);
      unlisten.then((stop) => stop());
    };
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!text.trim() || added) return;
    try {
      await addInboxItem(text);
      text = "";
      error = "";
      added = true;
      await notifyInboxChanged();
      hideTimer = setTimeout(() => {
        added = false;
        appWindow.hide();
      }, CONFIRM_MS);
    } catch (e) {
      error = String(e);
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      appWindow.hide();
    }
  }
</script>

<svelte:window {onkeydown} />

<form class="flex h-screen flex-col justify-center gap-2 border border-line-strong bg-raised px-4" onsubmit={save}>
  <div class="flex items-center gap-3">
    <span class={added ? "text-success" : "text-accent-text"}><Icon name={added ? "check-circle" : "inbox"} size={18} /></span>
    {#if added}
      <p class="flex-1 text-base text-strong" role="status">Added to Inbox</p>
    {:else}
      <input
        bind:this={input}
        bind:value={text}
        class="min-w-0 flex-1 bg-transparent text-base text-strong outline-none placeholder:text-faint"
        placeholder="Capture an idea or task…"
        aria-label="Idea or task"
        autocomplete="off"
        spellcheck="false"
      />
    {/if}
  </div>
  {#if error}
    <p class="truncate text-xs text-danger" title={error}>{error}</p>
  {:else}
    <p class="flex items-center gap-1.5 text-xs text-faint">
      <kbd class="kbd">Enter</kbd> save to Inbox
      <span>·</span>
      <kbd class="kbd">Esc</kbd> close
      <span>·</span>
      <span>{quickCaptureKeys()} from anywhere</span>
    </p>
  {/if}
</form>
