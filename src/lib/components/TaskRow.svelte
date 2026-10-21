<script lang="ts">
  import { tick } from "svelte";
  import { todayString } from "$lib/dates";
  import { MISC_COLOR, MISC_LABEL, type Task } from "$lib/types";
  import DeadlineLabel from "./DeadlineLabel.svelte";
  import Icon from "./Icon.svelte";
  import PriorityBadge from "./PriorityBadge.svelte";
  import ProjectDot from "./ProjectDot.svelte";
  import { settings } from "$lib/settings.svelte";
  import { plainKey } from "$lib/shortcuts.svelte";

  type TaskAction = (task: Task) => void | Promise<void>;

  interface Props {
    task: Task;
    showProject?: boolean;
    ontoggle: TaskAction;
    onedit: TaskAction;
    /** Deletes right away; the page shows an Undo message. */
    ondelete: TaskAction;
    /** Shows the sun button that adds the task to, or removes it from, the Today list. */
    onplan?: TaskAction;
    /** Shows the button that moves the task to its project's stash (the project page). */
    onstash?: TaskAction;
  }

  let { task, showProject = false, ontoggle, onedit, ondelete, onplan, onstash }: Props = $props();

  let plannedToday = $derived(task.planned_for === todayString());
  let checkLeft = $derived(settings.done_toggle_side === "left");

  // Finished tasks step back: dimmed until the row is hovered or focused.
  const dim = "opacity-50 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100";

  // ----- Keyboard: rows are focusable (j/k or arrows to move, see shortcuts.svelte.ts) -----

  const allRows = () => [...document.querySelectorAll<HTMLElement>("[data-task-row]")];
  const rowFor = (id: string | undefined) =>
    id ? document.querySelector<HTMLElement>(`[data-task-row][data-task-id="${id}"]`) : null;

  /**
   * Runs an action, then puts focus back on this task: the list reloads and the row may move
   * (done tasks sink on Today). If the row is gone (e.g. taken off Today), the next one gets focus.
   */
  async function runAction(row: HTMLElement, action: TaskAction) {
    const rows = allRows();
    const i = rows.indexOf(row);
    const neighbour = (rows[i + 1] ?? rows[i - 1])?.dataset.taskId;
    const id = row.dataset.taskId;
    await action(task);
    await tick();
    (rowFor(id) ?? rowFor(neighbour))?.focus();
  }

  function onkeydown(e: KeyboardEvent) {
    // Only when the row itself is focused: the checkbox and buttons inside keep their own keys.
    if (e.target !== e.currentTarget) return;
    const row = e.currentTarget as HTMLElement;
    const key = plainKey(e);
    if (key === null) return;

    const move = (step: number) => {
      const rows = allRows();
      rows[rows.indexOf(row) + step]?.focus();
    };

    const actions: Record<string, () => void> = {
      j: () => move(1),
      ArrowDown: () => move(1),
      k: () => move(-1),
      ArrowUp: () => move(-1),
      x: () => runAction(row, ontoggle),
      " ": () => runAction(row, ontoggle),
      e: () => onedit(task),
      Enter: () => onedit(task),
      Delete: () => runAction(row, ondelete),
    };
    if (onplan) actions.t = () => runAction(row, onplan);
    if (onstash) actions.s = () => runAction(row, onstash);

    const action = actions[key];
    if (action) {
      e.preventDefault(); // also tells the global handler the key was used
      action();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
<div
  class="group relative list-row outline-none focus-visible:bg-hover focus-visible:shadow-[inset_2px_0_0_var(--accent)]"
  tabindex="0"
  data-task-row
  data-task-id={task.id}
  aria-label={task.title}
  {onkeydown}
>
  <!-- The done toggle sits at the end of the row, or at the start (Settings → Appearance). -->
  {#snippet doneToggle()}
    <input
      type="checkbox"
      class="check-round {checkLeft ? '' : 'ml-2'} {task.is_done ? dim : ''}"
      checked={task.is_done}
      onchange={() => ontoggle(task)}
      aria-label="Mark {task.title} as done"
    />
  {/snippet}

  {#if checkLeft}{@render doneToggle()}{/if}
  <div class="min-w-0 flex-1 {task.is_done ? dim : ''}">
    <p class="truncate text-sm {task.is_done ? 'text-faint line-through' : 'text-fg'}">
      {task.title}
    </p>
    {#if showProject || task.milestone_title || task.status === "in_progress"}
      <p class="flex items-center gap-1.5 truncate text-xs text-faint">
        {#if task.status === "in_progress"}
          <span class="inline-flex shrink-0 items-center gap-1 text-accent-text">
            <span class="size-1.5 rounded-full bg-current"></span>In progress
          </span>
        {/if}
        {#if showProject}
          <!-- A Misc task (no project) links to the Misc page instead. -->
          <a
            href={task.project_id === null ? "/misc" : `/projects/${task.project_id}?tab=tasks`}
            class="inline-flex min-w-0 items-center gap-1.5 hover:text-fg"
          >
            <ProjectDot color={task.project_color ?? MISC_COLOR} /><span class="truncate">{task.project_name ?? MISC_LABEL}</span>
          </a>
        {/if}
        {#if task.milestone_title}
          {#if showProject}<span aria-hidden="true">·</span>{/if}
          <span class="inline-flex min-w-0 items-center gap-1">
            {#if !showProject}<Icon name="flag" size={12} />{/if}<span class="truncate">{task.milestone_title}</span>
          </span>
        {/if}
      </p>
    {/if}
  </div>

  {#if !task.is_done}<PriorityBadge priority={task.priority} />{/if}
  <div class="w-22 shrink-0 text-right {task.is_done ? dim : ''}"><DeadlineLabel date={task.due_date} done={task.is_done} /></div>

  <!-- Float over the priority and due date on hover or keyboard focus (T, S, E and Delete also work on
       a focused row). The sun is in the accent color while the task is on today's list. -->
  <div class="row-actions {checkLeft ? 'row-actions-end' : ''}">
    {#if onplan}
      <button
        type="button"
        class="icon-btn size-8 {plannedToday ? 'text-accent-text hover:text-accent-text' : ''}"
        aria-label={plannedToday ? "Remove from Today" : "Add to Today"}
        title={plannedToday ? "Remove from Today (T)" : "Add to Today (T)"}
        aria-pressed={plannedToday}
        onclick={() => onplan(task)}
      >
        <Icon name="sun" size={16} />
      </button>
    {/if}
    {#if onstash}
      <button type="button" class="icon-btn size-8" aria-label="Move to stash" title="Move to stash (S)" onclick={() => onstash(task)}>
        <Icon name="archive" size={15} />
      </button>
    {/if}
    <button type="button" class="icon-btn size-8" aria-label="Edit task" title="Edit (E)" onclick={() => onedit(task)}>
      <Icon name="edit" size={15} />
    </button>
    <button type="button" class="icon-btn icon-btn-danger size-8" aria-label="Delete task" title="Delete (Delete)" onclick={() => ondelete(task)}>
      <Icon name="trash" size={15} />
    </button>
  </div>

  {#if !checkLeft}{@render doneToggle()}{/if}
</div>
