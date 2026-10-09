<script lang="ts">
  import { PRIORITY_LABELS, type Priority } from "$lib/types";

  let { priority }: { priority: Priority } = $props();

  const dot: Record<Priority, string> = {
    high: "bg-red-400",
    medium: "bg-amber-400",
    low: "bg-zinc-500",
  };
</script>

<span class="inline-flex items-center gap-1.5 text-xs text-zinc-400">
  <span class="size-1.5 rounded-full {dot[priority]}"></span>
  {PRIORITY_LABELS[priority]}
</span>
