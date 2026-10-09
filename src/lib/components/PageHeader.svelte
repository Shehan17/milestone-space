<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, subtitle, actions }: { title: string; subtitle?: string; actions?: Snippet } =
    $props();
</script>

<header class="flex min-h-14 items-center justify-between gap-4 border-b border-zinc-800/80 px-8 py-3">
  <div class="min-w-0">
    <h1 class="truncate text-base font-semibold text-zinc-100">{title}</h1>
    {#if subtitle}
      <p class="truncate text-xs text-zinc-500">{subtitle}</p>
    {/if}
  </div>
  {#if actions}
    <div class="flex shrink-0 items-center gap-2">{@render actions()}</div>
  {/if}
</header>
