<!-- What to show instead of an empty list: what's missing, and the button that fixes it. -->
<script lang="ts">
  import Icon, { type IconName } from "./Icon.svelte";

  interface Props {
    message: string;
    /** A second, quieter line: why it's empty or what to do. */
    hint?: string;
    icon?: IconName;
    action?: { label: string; onclick: () => void; icon?: IconName; primary?: boolean };
    /** Less padding, for small cards. */
    compact?: boolean;
  }

  let { message, hint, icon, action, compact = false }: Props = $props();
</script>

<div class="flex flex-col items-center px-4 text-center {compact ? 'py-6' : 'py-10'}">
  {#if icon}
    <span class="mb-3 grid size-9 place-items-center rounded-full bg-hover text-faint"><Icon name={icon} size={18} /></span>
  {/if}
  <p class="text-sm text-fg">{message}</p>
  {#if hint}
    <p class="mt-1 max-w-sm text-xs text-faint">{hint}</p>
  {/if}
  {#if action}
    <button type="button" class="btn btn-sm mt-4 {action.primary ? 'btn-primary' : 'btn-secondary'}" onclick={action.onclick}>
      {#if action.icon}<Icon name={action.icon} size={12} />{/if}{action.label}
    </button>
  {/if}
</div>
