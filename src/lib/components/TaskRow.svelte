<script lang="ts">
  import type { Task } from "$lib/types";
  import DeadlineLabel from "./DeadlineLabel.svelte";
  import Icon from "./Icon.svelte";
  import PriorityBadge from "./PriorityBadge.svelte";
  import ProjectDot from "./ProjectDot.svelte";

  interface Props {
    task: Task;
    showProject?: boolean;
    ontoggle: (task: Task) => void;
    onedit: (task: Task) => void;
    ondelete: (task: Task) => void;
  }

  let { task, showProject = false, ontoggle, onedit, ondelete }: Props = $props();
</script>

<div class="group flex items-center gap-3 px-4 py-2 hover:bg-zinc-800/30">
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
    {#if showProject || task.milestone_title}
      <p class="flex items-center gap-1.5 truncate text-xs text-zinc-500">
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

  <div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
    <button type="button" class="icon-btn" aria-label="Edit task" onclick={() => onedit(task)}>
      <Icon name="edit" size={14} />
    </button>
    <button type="button" class="icon-btn hover:text-red-400" aria-label="Delete task" onclick={() => ondelete(task)}>
      <Icon name="trash" size={14} />
    </button>
  </div>
</div>
