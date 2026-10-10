<script lang="ts">
  import { onMount } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import DeadlineLabel from "$lib/components/DeadlineLabel.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PriorityBadge from "$lib/components/PriorityBadge.svelte";
  import ProjectDot from "$lib/components/ProjectDot.svelte";
  import TaskForm, { emptyTask } from "$lib/components/TaskForm.svelte";
  import TaskRow from "$lib/components/TaskRow.svelte";
  import { addTask, deleteTask, getMilestones, getProjects, getTasks, setTaskDone, setTasksPlanned, updateTask } from "$lib/db";
  import { daysUntil, formatDate, formatLongDate, todayString } from "$lib/dates";
  import type { Milestone, Priority, Project, Task, TaskInput } from "$lib/types";
  import { useShortcuts } from "$lib/shortcuts.svelte";

  let tasks = $state<Task[]>([]);
  let projects = $state<Project[]>([]);
  let milestones = $state<Milestone[]>([]);
  let today = $state(todayString());

  async function load() {
    today = todayString();
    const [t, p, m] = await Promise.all([getTasks(), getProjects(), getMilestones()]);
    tasks = t;
    projects = p;
    milestones = m;
  }

  onMount(load);

  // The app may stay open overnight: start the new day's list when the window is focused again.
  function onfocus() {
    if (todayString() !== today) load();
  }

  const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

  /** Higher priority first, then earlier due date (no date last). */
  function byUrgency(a: Task, b: Task) {
    return (
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      a.id - b.id
    );
  }

  // Today's list: open tasks first, finished ones stay at the bottom until tomorrow.
  let todayTasks = $derived(
    tasks.filter((t) => t.planned_for === today).sort((a, b) => Number(a.is_done) - Number(b.is_done) || byUrgency(a, b))
  );
  let doneCount = $derived(todayTasks.filter((t) => t.is_done).length);

  // Planned for an earlier day but not finished. Offered again rather than moved over automatically.
  let leftover = $derived(
    tasks
      .filter((t) => !t.is_done && t.planned_for !== null && t.planned_for < today)
      .sort((a, b) => b.planned_for!.localeCompare(a.planned_for!) || byUrgency(a, b))
  );

  function plannedLabel(day: string) {
    const days = daysUntil(day);
    return days === -1 ? "yesterday" : formatDate(day);
  }

  async function toggle(t: Task) {
    await setTaskDone(t.id, !t.is_done);
    await load();
  }

  async function plan(ids: number[], day: string | null) {
    await setTasksPlanned(ids, day);
    await load();
  }

  async function remove(t: Task) {
    await deleteTask(t.id);
    await load();
  }

  // ----- Picker: choose today's tasks from every project -----
  let pickerOpen = $state(false);
  let search = $state("");
  const selected = new SvelteSet<number>();

  let completedIds = $derived(new Set(projects.filter((p) => p.status === "completed").map((p) => p.id)));

  // Open tasks not already on today's list, from projects that aren't completed.
  let candidates = $derived(
    tasks.filter((t) => !t.is_done && t.planned_for !== today && !completedIds.has(t.project_id))
  );
  let matching = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((t) => t.title.toLowerCase().includes(q) || t.project_name.toLowerCase().includes(q));
  });

  // Overdue or due within 3 days goes first; everything else is grouped by project.
  const isDueSoon = (t: Task) => t.due_date !== null && daysUntil(t.due_date) <= 3;
  let dueSoon = $derived(matching.filter(isDueSoon).sort((a, b) => a.due_date!.localeCompare(b.due_date!)));
  let byProject = $derived(
    projects
      .map((p) => ({ project: p, tasks: matching.filter((t) => t.project_id === p.id && !isDueSoon(t)).sort(byUrgency) }))
      .filter((g) => g.tasks.length > 0)
  );

  function openPicker() {
    search = "";
    selected.clear();
    pickerOpen = true;
  }

  function togglePick(id: number) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
  }

  async function savePicker() {
    await plan([...selected], today);
    pickerOpen = false;
  }

  // ----- Task form: new tasks go straight onto today's list -----
  let formOpen = $state(false);
  let editingId = $state<number | null>(null);
  let draft = $state<TaskInput>(emptyTask(0));

  let openProjects = $derived(projects.filter((p) => p.status !== "completed"));

  function openNew() {
    editingId = null;
    draft = emptyTask(openProjects[0]?.id ?? 0);
    formOpen = true;
  }

  function openEdit(t: Task) {
    editingId = t.id;
    draft = { project_id: t.project_id, milestone_id: t.milestone_id, title: t.title, priority: t.priority, due_date: t.due_date, status: t.status };
    formOpen = true;
  }

  async function save() {
    if (!draft.title.trim() || !draft.project_id) return;
    if (editingId === null) await addTask(draft, today);
    else await updateTask(editingId, draft);
    formOpen = false;
    await load();
  }

  useShortcuts({ n: () => openProjects.length > 0 && openNew(), p: openPicker });
</script>

<svelte:window {onfocus} />

{#snippet pickRow(task: Task, showProject: boolean)}
  <label class="flex cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-zinc-800/40">
    <input type="checkbox" class="checkbox" checked={selected.has(task.id)} onchange={() => togglePick(task.id)} />
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm text-zinc-200">{task.title}</p>
      {#if showProject}
        <p class="flex items-center gap-1.5 truncate text-xs text-zinc-500">
          <ProjectDot color={task.project_color} size={7} />{task.project_name}
        </p>
      {/if}
    </div>
    <PriorityBadge priority={task.priority} />
    {#if task.due_date}
      <span class="w-24 shrink-0 text-right"><DeadlineLabel date={task.due_date} /></span>
    {/if}
  </label>
{/snippet}

<PageHeader title="Today" subtitle={formatLongDate(today)}>
  {#snippet actions()}
    <button type="button" class="btn btn-ghost" onclick={openNew} disabled={openProjects.length === 0}>
      <Icon name="plus" size={14} />New task
    </button>
    <button type="button" class="btn btn-primary" onclick={openPicker}>
      <Icon name="sun" size={14} />Pick tasks
    </button>
  {/snippet}
</PageHeader>

<div class="max-w-4xl space-y-6 px-8 py-6">
  <section class="card">
    {#if todayTasks.length > 0}
      <div class="flex items-center gap-3 border-b border-zinc-800 px-4 py-2.5">
        <h2 class="text-xs font-semibold text-zinc-300">Your list</h2>
        <div class="h-1 max-w-48 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div class="h-full bg-violet-500" style="width: {(doneCount / todayTasks.length) * 100}%"></div>
        </div>
        <span class="text-xs text-zinc-500 tabular-nums">{doneCount} of {todayTasks.length} done</span>
      </div>
      <div class="divide-y divide-zinc-800/70">
        {#each todayTasks as task (task.id)}
          <TaskRow
            {task}
            showProject
            ontoggle={toggle}
            onedit={openEdit}
            ondelete={remove}
            onplan={(t) => plan([t.id], null)}
          />
        {/each}
      </div>
    {:else}
      <div class="px-4 py-10 text-center">
        <p class="text-sm text-zinc-300">Nothing planned for today yet.</p>
        <p class="mt-1 text-xs text-zinc-500">Pick the tasks you'll work on today from all your projects.</p>
        <button type="button" class="btn btn-primary mt-4" onclick={openPicker}>
          <Icon name="sun" size={14} />Pick tasks
        </button>
      </div>
    {/if}
  </section>

  {#if leftover.length > 0}
    <section class="card">
      <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <h2 class="text-xs font-semibold text-zinc-400">
          Unfinished from earlier days <span class="ml-1 text-zinc-500">{leftover.length}</span>
        </h2>
        <button
          type="button"
          class="btn btn-ghost px-2 py-1 text-xs"
          onclick={() => plan(leftover.map((t) => t.id), today)}
        >
          <Icon name="sun" size={12} />Add all to today
        </button>
      </div>
      <div class="divide-y divide-zinc-800/70">
        {#each leftover as task (task.id)}
          <div class="group flex items-center gap-3 px-4 py-2 hover:bg-zinc-800/30">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm text-zinc-300">{task.title}</p>
              <p class="flex items-center gap-1.5 truncate text-xs text-zinc-500">
                <a href="/projects/{task.project_id}" class="inline-flex items-center gap-1.5 hover:text-zinc-300">
                  <ProjectDot color={task.project_color} size={7} />{task.project_name}
                </a>
                <span>· planned {plannedLabel(task.planned_for!)}</span>
              </p>
            </div>
            <div class="w-28 shrink-0 text-right"><DeadlineLabel date={task.due_date} /></div>
            <button type="button" class="btn btn-ghost px-2 py-1 text-xs" onclick={() => plan([task.id], today)}>
              <Icon name="sun" size={12} />Today
            </button>
            <button
              type="button"
              class="icon-btn"
              aria-label="Take {task.title} off the plan"
              title="Take off the plan (the task stays in its project)"
              onclick={() => plan([task.id], null)}
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        {/each}
      </div>
    </section>
  {/if}
</div>

<Modal
  open={pickerOpen}
  title="Pick today's tasks"
  submitLabel={selected.size > 0 ? `Add ${selected.size} to Today` : "Done"}
  onclose={() => (pickerOpen = false)}
  onsubmit={savePicker}
>
  <input class="input" placeholder="Search tasks or projects" bind:value={search} aria-label="Search tasks" />
  <div class="-mx-5 max-h-[50vh] overflow-y-auto border-y border-zinc-800">
    {#if dueSoon.length > 0}
      <p class="px-3 pt-3 pb-1 text-[11px] font-medium tracking-wide text-orange-400 uppercase">Due soon</p>
      {#each dueSoon as task (task.id)}
        {@render pickRow(task, true)}
      {/each}
    {/if}
    {#each byProject as group (group.project.id)}
      <p class="flex items-center gap-1.5 px-3 pt-3 pb-1 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
        <ProjectDot color={group.project.color} size={7} />{group.project.name}
      </p>
      {#each group.tasks as task (task.id)}
        {@render pickRow(task, false)}
      {/each}
    {/each}
    {#if matching.length === 0}
      <EmptyState message={candidates.length === 0 ? "No open tasks left to pick." : "No tasks match your search."} />
    {/if}
  </div>
</Modal>

<Modal open={formOpen} title={editingId === null ? "New task for today" : "Edit task"} onclose={() => (formOpen = false)} onsubmit={save}>
  <TaskForm bind:values={draft} projects={editingId === null ? openProjects : projects} {milestones} />
</Modal>
