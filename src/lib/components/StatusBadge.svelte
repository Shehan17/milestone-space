<script lang="ts">
  import { STATUS_LABELS, type ProjectStatus } from "$lib/types";

  let { status }: { status: ProjectStatus } = $props();

  // Active is the accent; on hold and completed step back. No warm colors: those mean "late".
  const styles: Record<ProjectStatus, string> = {
    active: "bg-accent/14 text-accent-text-strong",
    on_hold: "bg-selected text-muted",
    completed: "bg-selected text-muted",
  };
</script>

<span class="badge rounded-full px-2.5 {styles[status]}">{STATUS_LABELS[status]}</span>
