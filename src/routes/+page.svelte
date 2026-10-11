<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import { SvelteSet } from "svelte/reactivity";
  import { goto } from "$app/navigation";
  import DeadlineLabel from "$lib/components/DeadlineLabel.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PriorityBadge from "$lib/components/PriorityBadge.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import ProjectDot from "$lib/components/ProjectDot.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import TaskForm, { defaultProjectId, emptyTask, rememberProject } from "$lib/components/TaskForm.svelte";
  import TaskRow from "$lib/components/TaskRow.svelte";
  import { addTask, deleteTask, getMilestones, getProjects, getTasks, setTaskDone, setTasksPlanned, updateTask } from "$lib/db";
  import { daysUntil, formatDate, formatLongDate, todayString } from "$lib/dates";
  import { ms } from "$lib/motion";
  import { toast } from "$lib/toast.svelte";
  import type { Milestone, Priority, Project, Task, TaskInput } from "$lib/types";
  import { useShortcuts } from "$lib/shortcuts.svelte";

  let tasks = $state<Task[]>([]);
  let projects = $state<Project[]>([]);
  let milestones = $state<Milestone[]>([]);
  let loaded = $state(false);
  let today = $state(todayString());

  async function load() {
    today = todayString();
    const [t, p, m] = await Promise.all([getTasks(), getProjects(), getMilestones()]);
    tasks = t;
    projects = p;
    milestones = m;
    loaded = true;
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

  let completedIds = $derived(new Set(projects.filter((p) => p.status === "completed").map((p) => p.id)));

  // Today's list: open tasks first, finished ones stay at the bottom until tomorrow.
  let todayTasks = $derived(
    tasks.filter((t) => t.planned_for === today).sort((a, b) => Number(a.is_done) - Number(b.is_done) || byUrgency(a, b))
  );
  let doneCount = $derived(todayTasks.filter((t) => t.is_done).length);

  // Due today or overdue, but not on any day's list: offered so nothing late goes unseen.
  let dueNotPlanned = $derived(
    tasks
      .filter((t) => !t.is_done && t.planned_for === null && t.due_date !== null && t.due_date <= today)
      .filter((t) => !completedIds.has(t.project_id))
      .sort((a, b) => a.due_date!.localeCompare(b.due_date!) || byUrgency(a, b))
  );

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

  async function addAllToToday(ids: number[]) {
    await plan(ids, today);
    toast.success(ids.length === 1 ? "Added to Today" : `${ids.length} tasks added to Today`);
  }

  /** Takes a task off its day's list, with Undo (it disappears from view). */
  async function unplan(t: Task, message: string) {
    const day = t.planned_for;
    await plan([t.id], null);
    toast.undo(message, () => plan([t.id], day));
  }

  async function remove(t: Task) {
    const undo = await deleteTask(t.id);
    await load();
    toast.undo("Task deleted", async () => {
      await undo();
      await load();
    });
  }

  // ----- Picker: choose today's tasks from every project -----
  let pickerOpen = $state(false);
  let search = $state("");
  const selected = new SvelteSet<number>();

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
    const ids = [...selected];
    pickerOpen = false;
    if (ids.length > 0) await addAllToToday(ids);
  }

  // ----- Task form: new tasks go straight onto today's list -----
  let formOpen = $state(false);
  let editingId = $state<number | null>(null);
  let draft = $state<TaskInput>(emptyTask(0));

  let openProjects = $derived(projects.filter((p) => p.status !== "completed"));

  function openNew() {
    if (openProjects.length === 0) return;
    editingId = null;
    draft = emptyTask(defaultProjectId(openProjects));
    formOpen = true;
  }

  function openEdit(t: Task) {
    editingId = t.id;
    draft = { project_id: t.project_id, milestone_id: t.milestone_id, title: t.title, priority: t.priority, due_date: t.due_date, status: t.status };
    formOpen = true;
  }

  async function save() {
    if (!draft.title.trim() || !draft.project_id) return;
    if (editingId === null) {
      await addTask(draft, today);
      rememberProject(draft.project_id);
      toast.success("Task added to Today");
    } else {
      await updateTask(editingId, draft);
      toast.success("Task saved");
    }
    formOpen = false;
    await load();
  }

  function deleteEditing() {
    const t = tasks.find((x) => x.id === editingId);
    formOpen = false;
    if (t) remove(t);
  }

  useShortcuts({ n: openNew, p: openPicker });
</script>

<svelte:window {onfocus} />

{#snippet pickRow(task: Task, showProject: boolean)}
  <label class="flex cursor-pointer items-center gap-3 px-5 py-1.5 transition-colors duration-150 hover:bg-hover">
    <input type="checkbox" class="checkbox" checked={selected.has(task.id)} onchange={() => togglePick(task.id)} />
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm text-fg">{task.title}</p>
      {#if showProject}
        <p class="flex items-center gap-1.5 truncate text-xs text-faint">
          <ProjectDot color={task.project_color} size={7} />{task.project_name}
        </p>
      {/if}
    </div>
    <PriorityBadge priority={task.priority} />
    <span class="w-24 shrink-0 text-right"><DeadlineLabel date={task.due_date} /></span>
  </label>
{/snippet}

<!-- A task offered for today (due, or left over from an earlier day): one click puts it on the list. -->
{#snippet offerRow(task: Task, note: string, onremove?: () => void)}
  <div class="group list-row">
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm text-fg">{task.title}</p>
      <p class="flex items-center gap-1.5 truncate text-xs text-faint">
        <a href="/projects/{task.project_id}?tab=tasks" class="inline-flex min-w-0 items-center gap-1.5 hover:text-fg">
          <ProjectDot color={task.project_color} size={7} /><span class="truncate">{task.project_name}</span>
        </a>
        {#if note}<span class="shrink-0">· {note}</span>{/if}
      </p>
    </div>
    <div class="w-12 shrink-0"><PriorityBadge priority={task.priority} /></div>
    <div class="w-24 shrink-0 text-right"><DeadlineLabel date={task.due_date} /></div>
    <button type="button" class="btn btn-secondary btn-sm" onclick={() => plan([task.id], today)}>
      <Icon name="sun" size={12} />Today
    </button>
    {#if onremove}
      <button
        type="button"
        class="icon-btn"
        aria-label="Take {task.title} off the plan"
        title="Take off the plan (the task stays in its project)"
        onclick={onremove}
      >
        <Icon name="x" size={14} />
      </button>
    {/if}
  </div>
{/snippet}

<PageHeader title="Today" subtitle={formatLongDate(today)}>
  {#snippet actions()}
    <button
      type="button"
      class="btn btn-secondary"
      onclick={openNew}
      disabled={loaded && openProjects.length === 0}
      title={openProjects.length === 0 ? "Create a project first" : "New task for today (N)"}
    >
      <Icon name="plus" size={14} />New task
    </button>
    <button type="button" class="btn btn-primary" onclick={openPicker} title="Pick today's tasks (P)">
      <Icon name="sun" size={14} />Pick tasks
    </button>
  {/snippet}
</PageHeader>

<div class="page space-y-6 py-6">
  <section class="card">
    {#if !loaded}
      <Skeleton />
    {:else if todayTasks.length > 0}
      <div class="card-header">
        <h2 class="card-title">Your list</h2>
        <div class="flex min-w-0 flex-1 items-center justify-end gap-3">
          <div class="flex max-w-48 flex-1"><ProgressBar done={doneCount} total={todayTasks.length} /></div>
          <span class="text-xs text-faint tabular-nums">{doneCount} of {todayTasks.length} done</span>
        </div>
      </div>
      <div class="divide-y divide-line">
        {#each todayTasks as task (task.id)}
          <div animate:flip={{ duration: ms(200) }}>
            <TaskRow
              {task}
              showProject
              ontoggle={toggle}
              onedit={openEdit}
              ondelete={remove}
              onplan={(t) => unplan(t, "Removed from Today")}
            />
          </div>
        {/each}
      </div>
    {:else if projects.length === 0}
      <EmptyState
        icon="projects"
        message="Welcome to MilestoneSpace"
        hint="Create your first project, then add its tasks and pick what to work on each day."
        action={{ label: "New project", icon: "plus", primary: true, onclick: () => goto("/projects?new=1") }}
      />
    {:else}
      <EmptyState
        icon="sun"
        message="Nothing planned for today yet"
        hint={dueNotPlanned.length > 0
          ? "Some tasks are due. Add them below, or pick from all your projects."
          : "Pick the tasks you'll work on today from all your projects."}
        action={{ label: "Pick tasks", icon: "sun", primary: true, onclick: openPicker }}
      />
    {/if}
  </section>

  {#if dueNotPlanned.length > 0}
    {@const anyOverdue = dueNotPlanned.some((t) => t.due_date! < today)}
    <section class="card {anyOverdue ? 'border-danger/40' : ''}">
      <div class="card-header">
        <h2 class="card-title">
          <span class={anyOverdue ? "text-danger" : "text-warning"}><Icon name={anyOverdue ? "alert" : "calendar"} size={14} /></span>
          {anyOverdue ? "Overdue and due today" : "Due today"}
          <span class="count">{dueNotPlanned.length}</span>
        </h2>
        <button type="button" class="btn btn-ghost btn-sm" onclick={() => addAllToToday(dueNotPlanned.map((t) => t.id))}>
          <Icon name="sun" size={12} />Add all to Today
        </button>
      </div>
      <div class="divide-y divide-line">
        {#each dueNotPlanned as task (task.id)}
          {@render offerRow(task, "")}
        {/each}
      </div>
    </section>
  {/if}

  {#if leftover.length > 0}
    <section class="card">
      <div class="card-header">
        <h2 class="card-title">Unfinished from earlier days <span class="count">{leftover.length}</span></h2>
        <button type="button" class="btn btn-ghost btn-sm" onclick={() => addAllToToday(leftover.map((t) => t.id))}>
          <Icon name="sun" size={12} />Add all to Today
        </button>
      </div>
      <div class="divide-y divide-line">
        {#each leftover as task (task.id)}
          {@render offerRow(task, `planned ${plannedLabel(task.planned_for!)}`, () => unplan(task, "Taken off the plan"))}
        {/each}
      </div>
    </section>
  {/if}
</div>

<Modal
  open={pickerOpen}
  title="Pick today's tasks"
  description="Open tasks from all your active projects."
  size="lg"
  submitLabel={selected.size > 0 ? `Add ${selected.size} to Today` : "Done"}
  onclose={() => (pickerOpen = false)}
  onsubmit={savePicker}
>
  <input class="input" placeholder="Search tasks or projects" bind:value={search} aria-label="Search tasks" />
  <div class="-mx-5 max-h-[50vh] overflow-y-auto border-y border-line pb-2">
    {#if dueSoon.length > 0}
      <p class="eyebrow px-5 pt-3 pb-1 text-warning">Due soon</p>
      {#each dueSoon as task (task.id)}
        {@render pickRow(task, true)}
      {/each}
    {/if}
    {#each byProject as group (group.project.id)}
      <p class="eyebrow flex items-center gap-1.5 px-5 pt-3 pb-1">
        <ProjectDot color={group.project.color} size={7} />{group.project.name}
      </p>
      {#each group.tasks as task (task.id)}
        {@render pickRow(task, false)}
      {/each}
    {/each}
    {#if matching.length === 0}
      <EmptyState
        compact
        message={candidates.length === 0 ? "No open tasks left to pick" : "No tasks match your search"}
        hint={candidates.length === 0 ? "Everything open is already on today's list." : undefined}
      />
    {/if}
  </div>
</Modal>

<Modal
  open={formOpen}
  title={editingId === null ? "New task for today" : "Edit task"}
  onclose={() => (formOpen = false)}
  onsubmit={save}
  submitLabel={editingId === null ? "Add task" : "Save"}
  ondelete={editingId === null ? undefined : deleteEditing}
>
  <TaskForm bind:values={draft} projects={editingId === null ? openProjects : projects} {milestones} />
</Modal>
