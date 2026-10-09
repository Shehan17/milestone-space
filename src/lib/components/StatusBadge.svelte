<script lang="ts">
  import { STATUS_LABELS, type ProjectStatus } from "$lib/types";

  let { status }: { status: ProjectStatus } = $props();

  const styles: Record<ProjectStatus, string> = {
    active: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
    on_hold: "bg-amber-500/10 text-amber-300 ring-amber-500/25",
    completed: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/25",
  };
</script>

<span class="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset {styles[status]}">
  {STATUS_LABELS[status]}
</span>
