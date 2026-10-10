<!-- The preset project colors plus a custom one. -->
<script lang="ts">
  import { PROJECT_COLORS } from "$lib/types";

  let { value = $bindable() }: { value: string } = $props();

  let isCustomColor = $derived(!PROJECT_COLORS.includes(value));
</script>

<div>
  <span class="mb-1.5 block text-xs font-medium text-zinc-400">Color</span>
  <div class="flex items-center gap-2">
    {#each PROJECT_COLORS as color (color)}
      <button
        type="button"
        class="size-6 cursor-pointer rounded-full ring-offset-2 ring-offset-zinc-900 {value === color
          ? 'ring-2 ring-zinc-200'
          : 'hover:ring-2 hover:ring-zinc-600'}"
        style="background-color: {color}"
        aria-label="Color {color}"
        aria-pressed={value === color}
        onclick={() => (value = color)}
      ></button>
    {/each}
    <label
      class="relative size-6 cursor-pointer overflow-hidden rounded-full border border-dashed border-zinc-600 ring-offset-2 ring-offset-zinc-900 {isCustomColor
        ? 'ring-2 ring-zinc-200'
        : ''}"
      style={isCustomColor ? `background-color: ${value}` : undefined}
      title="Custom color"
    >
      <input type="color" class="absolute inset-0 cursor-pointer opacity-0" bind:value={value} />
      {#if !isCustomColor}<span class="grid size-full place-items-center text-xs text-zinc-500">+</span>{/if}
    </label>
  </div>
</div>
