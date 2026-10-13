<!--
  The main window's own title bar (tauri.conf.json turns the Windows frame off): logo and name on
  the left, the date and time in the middle, Windows-style minimize / maximize / close on the right. The empty space drags the window
  and double-clicking it maximizes (data-tauri-drag-region). Close goes through the window's
  CloseRequested handler in lib.rs, so "Close button minimizes to tray" still applies.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { formatLongDate, formatTime, toDateString } from "$lib/dates";

  const appWindow = getCurrentWindow();

  let maximized = $state(false);
  let now = $state(new Date());

  onMount(() => {
    const update = async () => (maximized = await appWindow.isMaximized());
    update();
    const unlisten = appWindow.onResized(update);
    const timer = setInterval(() => (now = new Date()), 1000);
    return () => {
      unlisten.then((stop) => stop());
      clearInterval(timer);
    };
  });

  // "Monday, 12 October · 12:54 AM", in the date and time formats from Settings.
  let clock = $derived(`${formatLongDate(toDateString(now))} · ${formatTime(`${now.getHours()}:${now.getMinutes()}`)}`);

  const buttonClass =
    "grid h-10 w-11.5 cursor-default place-items-center text-fg transition-colors duration-150 focus-visible:-outline-offset-2";
</script>

<div class="relative flex h-10 shrink-0 items-center bg-chrome pl-3.5 select-none" data-tauri-drag-region>
  <!-- Centered on the window, not between the name and the buttons. Clicks go through, so it still drags. -->
  <time class="pointer-events-none absolute left-1/2 -translate-x-1/2 text-ui whitespace-nowrap text-muted tabular-nums max-md:hidden">
    {clock}
  </time>
  <div class="flex min-w-0 flex-1 items-center gap-2.5" data-tauri-drag-region>
    <img src="/logo.png" alt="" class="pointer-events-none size-5 rounded-[5px]" />
    <span class="pointer-events-none truncate text-ui font-semibold text-strong">MilestoneSpace</span>
    {#if import.meta.env.DEV}
      <span class="badge pointer-events-none bg-accent/14 px-1.5 py-0 text-accent-text-strong" title="Development build: using tracker-dev.db">
        DEV
      </span>
    {/if}
  </div>
  <div class="flex h-10">
    <button type="button" class="{buttonClass} hover:bg-selected" aria-label="Minimize" title="Minimize" onclick={() => appWindow.minimize()}>
      <span class="h-px w-2.5 bg-current"></span>
    </button>
    <button
      type="button"
      class="{buttonClass} hover:bg-selected"
      aria-label={maximized ? "Restore" : "Maximize"}
      title={maximized ? "Restore" : "Maximize"}
      onclick={() => appWindow.toggleMaximize()}
    >
      {#if maximized}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" aria-hidden="true">
          <rect x="0.5" y="2.5" width="7" height="7" rx="1" />
          <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" />
        </svg>
      {:else}
        <span class="size-2.25 rounded-[1px] border border-current"></span>
      {/if}
    </button>
    <button
      type="button"
      class="{buttonClass} hover:bg-danger-solid hover:text-white"
      aria-label="Close"
      title="Close"
      onclick={() => appWindow.close()}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" aria-hidden="true"><path d="M0 0l10 10M10 0L0 10" /></svg>
    </button>
  </div>
</div>
