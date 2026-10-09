<script lang="ts">
  import { daysUntil, deadlineTone, formatDate, relativeDays } from "$lib/dates";

  // done = finished items are always shown in gray, never as overdue.
  let { date, done = false }: { date: string | null; done?: boolean } = $props();

  const toneClass = {
    overdue: "text-red-400",
    soon: "text-orange-400",
    normal: "text-zinc-400",
  };

  let days = $derived(date ? daysUntil(date) : 0);
</script>

{#if !date}
  <span class="text-xs text-zinc-600">No date</span>
{:else if done}
  <span class="text-xs text-zinc-500">{formatDate(date)}</span>
{:else}
  <span class="text-xs whitespace-nowrap {toneClass[deadlineTone(days)]}" title={formatDate(date)}>
    {relativeDays(days)}
  </span>
{/if}
