<!--
  Kanban board: To do / In progress / Done columns with drag and drop (native HTML5 drag events;
  tauri.conf.json sets dragDropEnabled: false so WebView2 delivers them).
  Keyboard: focus a card, ←/→ moves it to the previous/next column, Enter edits it, Delete deletes it.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { todayString } from "$lib/dates";
  import { plainKey } from "$lib/shortcuts.svelte";
  import { TASK_STATUSES, TASK_STATUS_LABELS, type Task, type TaskStatus } from "$lib/types";
  import DeadlineLabel from "./DeadlineLabel.svelte";
  import Icon from "./Icon.svelte";
  import PriorityBadge from "./PriorityBadge.svelte";

  interface Props {
    tasks: Task[];
    /** The task dropped into `status`; orderedIds is that column top to bottom, including it. */
    onmove: (task: Task, status: TaskStatus, orderedIds: number[]) => void | Promise<void>;
    onedit: (task: Task) => void;
    onadd: (status: TaskStatus) => void;
    ondelete: (task: Task) => void | Promise<void>;
  }

  let { tasks, onmove, onedit, onadd, ondelete }: Props = $props();

  const dotClass: Record<TaskStatus, string> = {
    todo: "bg-faint",
    in_progress: "bg-accent",
    done: "bg-line-strong",
  };

  /** Board order first (manual), then the oldest first. */
  function byBoardOrder(a: Task, b: Task) {
    return (a.board_order ?? Number.MAX_SAFE_INTEGER) - (b.board_order ?? Number.MAX_SAFE_INTEGER) || a.id - b.id;
  }

  let columns = $derived(
    TASK_STATUSES.map((status) => ({ status, tasks: tasks.filter((t) => t.status === status).sort(byBoardOrder) }))
  );

  const today = todayString();

  // ----- Drag and drop -----
  let dragging = $state<Task | null>(null);
  /** Where the card would land: column and index among that column's other cards. */
  let dropTarget = $state<{ status: TaskStatus; index: number } | null>(null);

  function ondragstart(event: DragEvent, task: Task) {
    dragging = task;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(task.id));
    }
  }

  function ondragend() {
    dragging = null;
    dropTarget = null;
  }

  function ondragover(event: DragEvent, status: TaskStatus) {
    if (!dragging) return;
    event.preventDefault(); // allows the drop
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    // Insert before the first card whose middle is below the pointer.
    const list = event.currentTarget as HTMLElement;
    const cards = [...list.querySelectorAll<HTMLElement>("[data-card-id]")].filter(
      (card) => card.dataset.cardId !== String(dragging?.id)
    );
    const index = cards.findIndex((card) => {
      const rect = card.getBoundingClientRect();
      return event.clientY < rect.top + rect.height / 2;
    });
    const next = { status, index: index === -1 ? cards.length : index };
    if (dropTarget?.status !== next.status || dropTarget.index !== next.index) dropTarget = next;
  }

  function ondragleave(event: DragEvent) {
    // Only when leaving the column itself, not when moving between its cards.
    const column = event.currentTarget as HTMLElement;
    if (!column.contains(event.relatedTarget as Node | null)) dropTarget = null;
  }

  async function ondrop(event: DragEvent) {
    event.preventDefault();
    const task = dragging;
    const target = dropTarget;
    dragging = null;
    dropTarget = null;
    if (task && target) await move(task, target.status, target.index);
  }

  async function move(task: Task, status: TaskStatus, index: number) {
    const others = columns.find((c) => c.status === status)!.tasks.filter((t) => t.id !== task.id);
    // Dropped back where it was: nothing to save.
    const currentIndex = others.filter((t) => byBoardOrder(t, task) < 0).length;
    if (task.status === status && currentIndex === index) return;
    const ids = others.map((t) => t.id);
    ids.splice(index, 0, task.id);
    await onmove(task, status, ids);
  }

  // ----- Keyboard -----
  async function oncardkeydown(event: KeyboardEvent, task: Task) {
    const key = plainKey(event);
    if (key === "Delete") {
      event.preventDefault();
      // Keep the keyboard on the board: focus the next card in the column (or the previous one).
      const column = columns.find((c) => c.status === task.status)!.tasks;
      const i = column.findIndex((t) => t.id === task.id);
      const neighbour = column[i + 1] ?? column[i - 1];
      await ondelete(task);
      await tick();
      if (neighbour) document.querySelector<HTMLElement>(`[data-card-id="${neighbour.id}"]`)?.focus();
      return;
    }
    if (key !== "ArrowLeft" && key !== "ArrowRight") return;
    const next = TASK_STATUSES[TASK_STATUSES.indexOf(task.status) + (key === "ArrowLeft" ? -1 : 1)];
    if (!next) return;
    event.preventDefault();
    const target = columns.find((c) => c.status === next)!;
    await move(task, next, target.tasks.length);
    await tick();
    document.querySelector<HTMLElement>(`[data-card-id="${task.id}"]`)?.focus();
  }
</script>

<div class="grid gap-3.5 md:grid-cols-3">
  {#each columns as column (column.status)}
    {@const isTarget = dropTarget?.status === column.status}
    {@const others = column.tasks.filter((t) => t.id !== dragging?.id)}
    <section
      class="flex min-h-70 flex-col rounded-card border p-3 transition-colors duration-150 {isTarget
        ? 'border-accent/60 bg-accent/5'
        : 'border-line bg-chrome'}"
      aria-label={TASK_STATUS_LABELS[column.status]}
      ondragover={(e) => ondragover(e, column.status)}
      {ondragleave}
      {ondrop}
    >
      <header class="mb-2.5 flex items-center gap-2 pl-1">
        <span class="size-2 rounded-full {dotClass[column.status]}"></span>
        <h3 class="text-ui font-semibold text-strong">{TASK_STATUS_LABELS[column.status]}</h3>
        <span class="count text-ui">{column.tasks.length}</span>
        <button
          type="button"
          class="icon-btn ml-auto"
          aria-label="Add task to {TASK_STATUS_LABELS[column.status]}"
          title="Add task"
          onclick={() => onadd(column.status)}
        >
          <Icon name="plus" size={14} />
        </button>
      </header>

      <div class="flex flex-1 flex-col gap-2.5">
        {#each column.tasks as task (task.id)}
          {#if isTarget && others[dropTarget!.index]?.id === task.id}
            <div class="h-0.5 rounded-full bg-accent"></div>
          {/if}
          <button
            type="button"
            draggable="true"
            data-card-id={task.id}
            class="cursor-grab rounded-item border border-line bg-raised px-3.5 py-3 text-left transition-colors duration-150 hover:border-line-strong active:cursor-grabbing {dragging?.id ===
            task.id
              ? 'opacity-40'
              : ''}"
            title="Drag to move · ←/→ change column · Enter edit · Delete delete"
            ondragstart={(e) => ondragstart(e, task)}
            {ondragend}
            onclick={() => onedit(task)}
            onkeydown={(e) => oncardkeydown(e, task)}
          >
            <p class="text-ui break-words {task.status === 'done' ? 'text-faint line-through' : 'text-fg'}">
              {task.title}
            </p>
            {#if task.priority !== "medium" || task.due_date || task.milestone_title || task.planned_for === today}
              <div class="mt-2 flex items-center gap-2">
                {#if task.status !== "done"}<PriorityBadge priority={task.priority} />{/if}
                <span class="min-w-0 flex-1 truncate text-xs text-faint">{task.milestone_title ?? ""}</span>
                {#if task.planned_for === today}
                  <span class="text-accent-text" title="On today's list"><Icon name="sun" size={13} /></span>
                {/if}
                {#if task.due_date}<DeadlineLabel date={task.due_date} done={task.status === "done"} />{/if}
              </div>
            {/if}
          </button>
        {/each}
        {#if isTarget && dropTarget!.index >= others.length}
          <div class="h-0.5 rounded-full bg-accent"></div>
        {/if}
        {#if column.tasks.length === 0 && !isTarget}
          <button
            type="button"
            class="flex flex-1 cursor-pointer items-center justify-center rounded-item border border-dashed border-line px-2 py-6 text-xs text-faint transition-colors duration-150 hover:border-line-strong hover:text-fg"
            onclick={() => onadd(column.status)}
          >
            Drop a task here or add one
          </button>
        {/if}
      </div>
    </section>
  {/each}
</div>
