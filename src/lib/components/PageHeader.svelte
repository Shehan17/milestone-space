<!--
  The top of every page: title, a line under it, and the page's buttons. It stays at the top
  while the page scrolls, so the main actions are always in reach.
-->
<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    subtitle?: string;
    /** Instead of `subtitle`, for a line with links or badges (project page). */
    meta?: Snippet;
    /** Before the title, e.g. a back button and the project color. */
    leading?: Snippet;
    actions?: Snippet;
  }

  let { title, subtitle, meta, leading, actions }: Props = $props();
</script>

<header class="sticky top-0 z-20 border-b border-line bg-canvas">
  <div class="page flex min-h-14 items-center justify-between gap-4 py-2.5">
    <div class="flex min-w-0 items-center gap-2.5">
      {#if leading}{@render leading()}{/if}
      <div class="min-w-0">
        <h1 class="truncate text-base font-semibold text-strong">{title}</h1>
        {#if meta}
          {@render meta()}
        {:else if subtitle}
          <p class="truncate text-xs text-faint">{subtitle}</p>
        {/if}
      </div>
    </div>
    {#if actions}
      <div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
    {/if}
  </div>
</header>
