<!-- A round progress indicator (Today's plan): done out of total, in the accent color. -->
<script lang="ts">
  let { done, total, size = 48 }: { done: number; total: number; size?: number } = $props();

  const RADIUS = 20;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  let fraction = $derived(total > 0 ? done / total : 0);
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 48 48"
  class="shrink-0 -rotate-90"
  role="progressbar"
  aria-valuemin={0}
  aria-valuemax={total}
  aria-valuenow={done}
  aria-label="{done} of {total} done"
>
  <circle cx="24" cy="24" r={RADIUS} fill="none" stroke="var(--selected)" stroke-width="5" />
  {#if fraction > 0}
    <circle
      cx="24"
      cy="24"
      r={RADIUS}
      fill="none"
      stroke="var(--accent)"
      stroke-width="5"
      stroke-linecap="round"
      stroke-dasharray="{CIRCUMFERENCE * fraction} {CIRCUMFERENCE}"
      class="transition-[stroke-dasharray] duration-300"
    />
  {/if}
</svg>
