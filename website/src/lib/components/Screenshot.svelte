<!-- An app screenshot from docs/screenshots in a bordered frame. `name` is the file name without the extension. -->
<script lang="ts">
  import { screenshots } from "$lib/assets";

  let {
    name,
    alt,
    width = 1920,
    height = 1020,
    eager = false,
  }: { name: string; alt: string; width?: number; height?: number; eager?: boolean } = $props();

  const src = $derived(screenshots[name]);
</script>

{#if src}
  <img
    {src}
    {alt}
    {width}
    {height}
    loading={eager ? "eager" : "lazy"}
    decoding="async"
    class="h-auto w-full rounded-dialog border border-line-strong shadow-2xl shadow-black/50"
  />
{/if}
