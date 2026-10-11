<!-- A thin progress bar: done out of total. The color defaults to the accent (projects pass their own). -->
<script lang="ts">
  let { done, total, color, label }: { done: number; total: number; color?: string; label?: string } = $props();

  let percent = $derived(total > 0 ? Math.round((done / total) * 100) : 0);
</script>

<div
  class="h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-line"
  role="progressbar"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={percent}
  aria-label={label ?? `${done} of ${total} done`}
>
  <div
    class="h-full rounded-full transition-[width] duration-200 {color ? '' : 'bg-accent'}"
    style="width: {percent}%;{color ? ` background-color: ${color}` : ''}"
  ></div>
</div>
