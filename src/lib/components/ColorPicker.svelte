<!-- The preset project colors plus a custom one. -->
<script lang="ts">
  import { PROJECT_COLORS } from "$lib/types";

  let { value = $bindable() }: { value: string } = $props();

  let isCustomColor = $derived(!PROJECT_COLORS.includes(value));
</script>

<div role="group" aria-label="Color" class="flex flex-wrap items-center gap-x-4 gap-y-1.5">
  <span class="text-xs font-medium text-muted">Color</span>
  <div class="flex flex-wrap items-center gap-2">
    {#each PROJECT_COLORS as color (color)}
      <button
        type="button"
        class="size-6 cursor-pointer rounded-full ring-offset-2 ring-offset-raised transition-shadow duration-150 {value === color
          ? 'ring-2 ring-strong'
          : 'hover:ring-2 hover:ring-line-strong'}"
        style="background-color: {color}"
        aria-label="Color {color}"
        aria-pressed={value === color}
        onclick={() => (value = color)}
      ></button>
    {/each}
    <label
      class="relative size-6 cursor-pointer overflow-hidden rounded-full border border-dashed border-line-strong ring-offset-2 ring-offset-raised focus-within:ring-2 focus-within:ring-accent {isCustomColor
        ? 'ring-2 ring-strong'
        : ''}"
      style={isCustomColor ? `background-color: ${value}` : undefined}
      title="Custom color"
    >
      <input type="color" class="absolute inset-0 cursor-pointer opacity-0" bind:value aria-label="Custom color" />
      {#if !isCustomColor}<span class="grid size-full place-items-center text-xs text-faint">+</span>{/if}
    </label>
  </div>
</div>
