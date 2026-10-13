<!-- One card on the Settings page. The id is the target of the page's side navigation. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { id, title, description, children }: { id: string; title: string; description?: string; children: Snippet } = $props();
</script>

<section {id} class="card scroll-mt-6" data-settings-section>
  <div class="border-b border-line px-5 py-4">
    <h2 class="text-base font-semibold text-strong">{title}</h2>
    {#if description}<p class="mt-0.5 text-ui text-muted">{description}</p>{/if}
  </div>
  <div class="divide-y divide-line">
    {@render children()}
  </div>
</section>
