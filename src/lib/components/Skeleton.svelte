<!-- Placeholder rows while a list loads. They fade in after 150 ms, so a fast load shows nothing. -->
<script lang="ts">
  let { rows = 3 }: { rows?: number } = $props();

  const WIDTHS = [55, 38, 47, 32];
  let items = $derived(Array.from({ length: rows }, (_, i) => WIDTHS[i % WIDTHS.length]));
</script>

<div class="divide-y divide-line" aria-busy="true" aria-label="Loading">
  {#each items as width, i (i)}
    <div class="flex items-center gap-3 px-5 py-4">
      <span class="skeleton size-4"></span>
      <span class="skeleton h-2.5" style="width: {width}%"></span>
      <span class="skeleton ml-auto h-2.5 w-14"></span>
    </div>
  {/each}
</div>
