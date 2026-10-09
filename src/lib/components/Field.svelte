<script lang="ts">
  import type { Snippet } from "svelte";

  let { label, children }: { label: string; children: Snippet } = $props();
</script>

<label class="block">
  <span class="mb-1 block text-xs font-medium text-zinc-400">{label}</span>
  {@render children()}
</label>
