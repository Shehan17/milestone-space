<!--
  A due date as it reads in lists: overdue in red, within 3 days in orange, otherwise gray.
  Close dates read relative ("tomorrow"), later ones as the date; the tooltip has the full date.
-->
<script lang="ts">
  import { daysUntil, deadlineText, deadlineTone, formatWeekdayDate } from "$lib/dates";

  interface Props {
    date: string | null;
    /** Finished items are shown in gray as a plain date, never as overdue. */
    done?: boolean;
    /** Text for no date. By default nothing is shown, which keeps lists quiet. */
    empty?: string;
  }

  let { date, done = false, empty = "" }: Props = $props();

  const toneClass = {
    overdue: "font-medium text-danger",
    soon: "text-warning",
    normal: "text-muted",
  };
</script>

{#if !date}
  {#if empty}<span class="text-xs text-faint">{empty}</span>{/if}
{:else if done}
  <span class="text-xs whitespace-nowrap text-faint" title={formatWeekdayDate(date)}>{formatWeekdayDate(date)}</span>
{:else}
  <span class="text-xs whitespace-nowrap {toneClass[deadlineTone(daysUntil(date))]}" title="Due {formatWeekdayDate(date)}">
    {deadlineText(date)}
  </span>
{/if}
