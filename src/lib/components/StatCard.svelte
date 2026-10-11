<script lang="ts">
  interface Props {
    label: string;
    /** null while loading. */
    value: number | null;
    /** Red when above zero (Overdue). */
    alert?: boolean;
    hint?: string;
  }

  let { label, value, alert = false, hint }: Props = $props();
</script>

<div class="card px-4 py-3 {alert && value ? 'border-danger/40' : ''}">
  <p class="text-xs text-faint">{label}</p>
  <p class="mt-1 text-2xl font-semibold tabular-nums {alert && value ? 'text-danger' : 'text-strong'}">
    {value ?? "–"}
  </p>
  {#if hint}<p class="truncate text-xs text-faint">{hint}</p>{/if}
</div>
