<!--
  Only the priorities that stand out are shown: High (red, it's urgent) and Low (quiet).
  Medium is the normal case, so it shows nothing and lists stay calm.
-->
<script lang="ts">
  import type { Priority } from "$lib/types";

  let { priority }: { priority: Priority } = $props();
</script>

{#if priority === "high"}
  <span class="badge bg-danger/14 text-danger" title="High priority">High</span>
{:else if priority === "low"}
  <span class="badge bg-hover font-medium text-faint" title="Low priority">Low</span>
{/if}
