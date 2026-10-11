<!--
  Only the priorities that stand out are shown: High (red, it's urgent) and Low (quiet).
  Medium is the normal case, so it shows nothing and lists stay calm.
-->
<script lang="ts">
  import type { Priority } from "$lib/types";
  import Icon from "./Icon.svelte";

  let { priority }: { priority: Priority } = $props();
</script>

{#if priority === "high"}
  <span class="inline-flex items-center gap-0.5 text-xs font-medium text-danger" title="High priority">
    <Icon name="arrow-up" size={12} />High
  </span>
{:else if priority === "low"}
  <span class="inline-flex items-center gap-0.5 text-xs text-faint" title="Low priority">
    <Icon name="arrow-down" size={12} />Low
  </span>
{/if}
