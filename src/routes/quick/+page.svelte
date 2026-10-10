<!--
  The quick capture box: its own small window, opened from anywhere with the global shortcut
  (src-tauri/src/lib.rs). Enter saves to the Inbox and hides the window; Esc or clicking
  elsewhere hides it and keeps what was typed for next time.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import Icon from "$lib/components/Icon.svelte";
  import { addInboxItem } from "$lib/db";
  import { notifyInboxChanged } from "$lib/inbox.svelte";
  import { quickCaptureKeys } from "$lib/settings.svelte";

  const appWindow = getCurrentWindow();

  let text = $state("");
  let error = $state("");
  let input = $state<HTMLInputElement>();

  onMount(() => {
    input?.focus();
    // Shown again: focus the box. Lost focus (clicked elsewhere): get out of the way.
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) input?.focus();
      else appWindow.hide();
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    try {
      await addInboxItem(text);
      text = "";
      error = "";
      await notifyInboxChanged();
      await appWindow.hide();
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

<form class="flex h-screen flex-col justify-center gap-2 border border-zinc-700 bg-zinc-900 px-4" onsubmit={save}>
  <div class="flex items-center gap-3">
    <span class="text-violet-400"><Icon name="inbox" size={18} /></span>
    <input
      bind:this={input}
      bind:value={text}
      class="min-w-0 flex-1 bg-transparent text-base text-zinc-100 outline-none placeholder:text-zinc-600"
      placeholder="Capture an idea or task…"
      aria-label="Idea or task"
      autocomplete="off"
      spellcheck="false"
    />
  </div>
  {#if error}
    <p class="truncate text-xs text-red-400" title={error}>{error}</p>
  {:else}
    <p class="text-xs text-zinc-500">
      <kbd class="font-sans text-zinc-400">Enter</kbd> save to Inbox ·
      <kbd class="font-sans text-zinc-400">Esc</kbd> close ·
      <span class="text-zinc-600">{quickCaptureKeys()} from anywhere</span>
    </p>
  {/if}
</form>
