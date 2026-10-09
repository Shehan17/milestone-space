<script lang="ts">
  let { label, value, alert = false }: { label: string; value: number; alert?: boolean } = $props();
</script>

<div class="card px-4 py-3">
  <p class="text-xs text-zinc-500">{label}</p>
  <p class="mt-1 text-2xl font-semibold tabular-nums {alert && value > 0 ? 'text-red-400' : 'text-zinc-100'}">
    {value}
  </p>
</div>
