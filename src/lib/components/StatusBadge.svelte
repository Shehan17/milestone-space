<script lang="ts">
  import { STATUS_LABELS, type ProjectStatus } from "$lib/types";
  import Icon, { type IconName } from "./Icon.svelte";

  let { status }: { status: ProjectStatus } = $props();

  // Active is the accent; on hold and completed step back. No warm colors: those mean "late".
  const styles: Record<ProjectStatus, string> = {
    active: "bg-accent/15 text-accent-text-strong",
    on_hold: "bg-hover text-muted",
    completed: "bg-hover text-muted",
  };
  const icons: Partial<Record<ProjectStatus, IconName>> = { on_hold: "pause", completed: "check" };
</script>

<span class="badge {styles[status]}">
  {#if icons[status]}
    <Icon name={icons[status]!} size={12} />
  {:else}
    <span class="size-1.5 rounded-full bg-current"></span>
  {/if}
  {STATUS_LABELS[status]}
</span>
