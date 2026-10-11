<!--
  A date field ("YYYY-MM-DD" or null) with one-click choices under it, and the picked date
  written out in the app's date format ("Fri, 17 Oct · in 7 days"), since the field itself
  follows the Windows format.
-->
<script lang="ts">
  import { dayFromToday, daysUntil, formatWeekdayDate, relativeDays, startOfNextWeek } from "$lib/dates";

  let { value = $bindable(), id }: { value: string | null; id?: string } = $props();

  function weekdayOf(date: string) {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en", { weekday: "short" });
  }

  // Worked out when the field is shown, so "Today" is right even if the app stays open overnight.
  const nextWeek = startOfNextWeek();
  const choices = [
    { label: "Today", date: dayFromToday(0) },
    { label: "Tomorrow", date: dayFromToday(1) },
    { label: `Next ${weekdayOf(nextWeek)}`, date: nextWeek },
    { label: "In 1 week", date: dayFromToday(7) },
  ];
</script>

<input {id} class="input" type="date" bind:value />
<div class="mt-1.5 flex flex-wrap items-center gap-1">
  {#each choices as choice (choice.label)}
    <button
      type="button"
      class="chip {value === choice.date ? 'chip-on' : ''}"
      aria-pressed={value === choice.date}
      onclick={() => (value = choice.date)}
    >
      {choice.label}
    </button>
  {/each}
  {#if value}
    <button type="button" class="chip" onclick={() => (value = null)}>Clear</button>
    <span class="ml-auto pl-2 text-xs text-faint">{formatWeekdayDate(value)} · {relativeDays(daysUntil(value))}</span>
  {/if}
</div>
