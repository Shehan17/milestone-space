<!-- A time of day ("HH:MM", 24 h) in 30-minute steps, shown in the 12 h / 24 h format from Settings. -->
<script lang="ts">
  import { formatTime } from "$lib/dates";

  let { value = $bindable(), label, disabled = false }: { value: string; label: string; disabled?: boolean } = $props();

  const pad = (n: number) => String(n).padStart(2, "0");
  const TIMES = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);
</script>

<select class="input input-sm w-28" bind:value aria-label={label} {disabled}>
  {#each TIMES as time (time)}
    <option value={time}>{formatTime(time)}</option>
  {/each}
</select>
