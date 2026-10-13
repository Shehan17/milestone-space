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

  let alarming = $derived(alert && !!value);
</script>

<div class="rounded-item border bg-surface p-3.5 {alarming ? 'border-danger/35' : 'border-line'}">
  <p class="text-[1.625rem] leading-8 font-semibold tabular-nums {alarming ? 'text-danger' : 'text-strong'}">
    {value ?? "–"}
  </p>
  <p class="mt-0.5 truncate text-xs text-faint">{label}</p>
  {#if hint}<p class="truncate text-xs text-faint">{hint}</p>{/if}
</div>
