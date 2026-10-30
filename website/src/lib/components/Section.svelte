<!-- A home page section: an anchor id (for the header links), an optional eyebrow, title and intro. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    id,
    eyebrow,
    title,
    intro,
    children,
  }: { id?: string; eyebrow?: string; title: string; intro?: string; children: Snippet } = $props();
</script>

<section {id} class="container-page py-20 sm:py-24">
  <div class="mx-auto mb-12 max-w-2xl text-center">
    {#if eyebrow}<p class="eyebrow mb-3">{eyebrow}</p>{/if}
    <h2 class="section-title">{title}</h2>
    {#if intro}<p class="mt-4 text-lg text-muted">{intro}</p>{/if}
  </div>
  {@render children()}
</section>
