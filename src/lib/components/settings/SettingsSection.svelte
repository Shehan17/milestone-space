<!-- One card on the Settings page. The id is the target of the page's side navigation. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { id, title, description, children }: { id: string; title: string; description?: string; children: Snippet } = $props();
</script>

<section {id} class="card scroll-mt-20" data-settings-section>
  <div class="border-b border-line px-4 py-2.5">
    <h2 class="text-sm font-semibold text-strong">{title}</h2>
    {#if description}<p class="text-xs text-faint">{description}</p>{/if}
  </div>
  <div class="divide-y divide-line">
    {@render children()}
  </div>
</section>
