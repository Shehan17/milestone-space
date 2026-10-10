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
  class="group flex items-center gap-3 px-4 py-2 outline-none hover:bg-zinc-800/30 focus-visible:bg-zinc-800/50 focus-visible:shadow-[inset_2px_0_0_var(--color-violet-500)]"
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
    <p class="truncate text-sm {task.is_done ? 'text-zinc-500 line-through' : 'text-zinc-200'}">
      {task.title}
    </p>
    {#if showProject || task.milestone_title || task.status === "in_progress"}
      <p class="flex items-center gap-1.5 truncate text-xs text-zinc-500">
        {#if task.status === "in_progress"}
          <span class="inline-flex items-center gap-1 text-violet-400">
            <span class="size-1.5 rounded-full bg-violet-400"></span>In progress
          </span>
        {/if}
        {#if showProject}
          <a href="/projects/{task.project_id}" class="inline-flex items-center gap-1.5 hover:text-zinc-300">
            <ProjectDot color={task.project_color} size={7} />{task.project_name}
          </a>
        {/if}
        {#if task.milestone_title}
          <span class="inline-flex items-center gap-1"><Icon name="flag" size={11} />{task.milestone_title}</span>
        {/if}
      </p>
    {/if}
  </div>

  <div class="w-16 shrink-0"><PriorityBadge priority={task.priority} /></div>
  <div class="w-28 shrink-0 text-right"><DeadlineLabel date={task.due_date} done={task.is_done} /></div>

  {#if onplan}
    <!-- Always visible while the task is on today's list, so the list membership is easy to see. -->
    <button
      type="button"
      class="icon-btn {plannedToday
        ? 'text-violet-400'
        : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}"
      aria-label={plannedToday ? "Remove from Today" : "Add to Today"}
      title={plannedToday ? "Remove from Today" : "Add to Today"}
      aria-pressed={plannedToday}
      onclick={() => onplan(task)}
    >
      <Icon name="sun" size={14} />
    </button>
  {/if}

  <div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
    <button type="button" class="icon-btn" aria-label="Edit task" onclick={() => onedit(task)}>
      <Icon name="edit" size={14} />
    </button>
    <button type="button" class="icon-btn hover:text-red-400" aria-label="Delete task" onclick={() => ondelete(task)}>
      <Icon name="trash" size={14} />
    </button>
  </div>
</div>
