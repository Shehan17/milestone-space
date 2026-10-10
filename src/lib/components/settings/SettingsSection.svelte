<!-- One card on the Settings page. The id is the target of the page's side navigation. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { id, title, description, children }: { id: string; title: string; description?: string; children: Snippet } = $props();
</script>

<section {id} class="card scroll-mt-6">
  <div class="border-b border-zinc-800 px-4 py-2.5">
    <h2 class="text-xs font-semibold text-zinc-300">{title}</h2>
    {#if description}<p class="text-xs text-zinc-500">{description}</p>{/if}
  </div>
  <div class="divide-y divide-zinc-800/70">
    {@render children()}
  </div>
</section>
