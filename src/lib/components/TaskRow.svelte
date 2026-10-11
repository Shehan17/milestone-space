<script lang="ts">
  import { tick } from "svelte";
  import { todayString } from "$lib/dates";
  import type { Task } from "$lib/types";
  import DeadlineLabel from "./DeadlineLabel.svelte";
  import Icon from "./Icon.svelte";
  import PriorityBadge from "./PriorityBadge.svelte";
  import ProjectDot from "./ProjectDot.svelte";
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
  }

  let { task, showProject = false, ontoggle, onedit, ondelete, onplan }: Props = $props();

  let plannedToday = $derived(task.planned_for === todayString());

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

    const action = actions[key];
    if (action) {
      e.preventDefault(); // also tells the global handler the key was used
      action();
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_static_element_interactions -->
<div
  class="group list-row outline-none focus-visible:bg-hover focus-visible:shadow-[inset_2px_0_0_var(--accent)]"
  tabindex="0"
  data-task-row
  data-task-id={task.id}
  aria-label={task.title}
  {onkeydown}
>
  <input
    type="checkbox"
    class="checkbox"
    checked={task.is_done}
    onchange={() => ontoggle(task)}
    aria-label="Mark {task.title} as done"
  />

  <div class="min-w-0 flex-1">
    <p class="truncate text-sm {task.is_done ? 'text-faint line-through' : 'text-fg'}">
      {task.title}
    </p>
    {#if showProject || task.milestone_title || task.status === "in_progress"}
      <p class="flex items-center gap-2 truncate text-xs text-faint">
        {#if task.status === "in_progress"}
          <span class="inline-flex shrink-0 items-center gap-1 text-accent-text">
            <span class="size-1.5 rounded-full bg-current"></span>In progress
          </span>
        {/if}
        {#if showProject}
          <a href="/projects/{task.project_id}?tab=tasks" class="inline-flex min-w-0 items-center gap-1.5 hover:text-fg">
            <ProjectDot color={task.project_color} size={7} /><span class="truncate">{task.project_name}</span>
          </a>
        {/if}
        {#if task.milestone_title}
          <span class="inline-flex min-w-0 items-center gap-1"><Icon name="flag" size={11} /><span class="truncate">{task.milestone_title}</span></span>
        {/if}
      </p>
    {/if}
  </div>

  <div class="w-12 shrink-0"><PriorityBadge priority={task.priority} /></div>
  <div class="w-24 shrink-0 text-right"><DeadlineLabel date={task.due_date} done={task.is_done} /></div>

  {#if onplan}
    <!-- Always visible while the task is on today's list, so the list membership is easy to see. -->
    <button
      type="button"
      class="icon-btn {plannedToday ? 'text-accent-text' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}"
      aria-label={plannedToday ? "Remove from Today" : "Add to Today"}
      title={plannedToday ? "Remove from Today (T)" : "Add to Today (T)"}
      aria-pressed={plannedToday}
      onclick={() => onplan(task)}
    >
      <Icon name="sun" size={14} />
    </button>
  {/if}

  <div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
    <button type="button" class="icon-btn" aria-label="Edit task" title="Edit (E)" onclick={() => onedit(task)}>
      <Icon name="edit" size={14} />
    </button>
    <button type="button" class="icon-btn icon-btn-danger" aria-label="Delete task" title="Delete (Delete)" onclick={() => ondelete(task)}>
      <Icon name="trash" size={14} />
    </button>
  </div>
</div>
