<!-- A card of related settings within a Settings section, with an optional title. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { title, description, children }: { title?: string; description?: string; children: Snippet } = $props();
</script>

<section class="card">
  {#if title}
    <div class="border-b border-line px-5 py-4">
      <h3 class="text-base font-semibold text-strong">{title}</h3>
      {#if description}<p class="mt-0.5 text-ui text-muted">{description}</p>{/if}
    </div>
  {/if}
  <div class="divide-y divide-line">
    {@render children()}
  </div>
</section>
