<script lang="ts">
  import { onMount } from "svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import TaskForm, { emptyTask } from "$lib/components/TaskForm.svelte";
  import TaskRow from "$lib/components/TaskRow.svelte";
  import { addTask, deleteTask, getMilestones, getProjects, getTasks, setTaskDone, setTasksPlanned, updateTask } from "$lib/db";
  import { todayString } from "$lib/dates";
  import { isArchived } from "$lib/settings.svelte";
  import { PRIORITIES, PRIORITY_LABELS, type Milestone, type Priority, type Project, type Task, type TaskInput } from "$lib/types";
  import { useShortcuts } from "$lib/shortcuts.svelte";

  let tasks = $state<Task[]>([]);
  let projects = $state<Project[]>([]);
  let milestones = $state<Milestone[]>([]);

  let statusFilter = $state<"open" | "in_progress" | "done" | "all">("open");
  let priorityFilter = $state<Priority | "all">("all");
  let projectFilter = $state<number | "all">("all");

  const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

  // Sorted by due date (no date last), then priority.
  let visible = $derived(
    tasks
      .filter((t) =>
        statusFilter === "all" ? true : statusFilter === "in_progress" ? t.status === "in_progress" : t.is_done === (statusFilter === "done")
      )
      .filter((t) => priorityFilter === "all" || t.priority === priorityFilter)
      .filter((t) => projectFilter === "all" || t.project_id === projectFilter)
      .sort((a, b) => {
        if (a.due_date !== b.due_date) {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        }
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      })
  );

  let statusTabs = $derived([
    { value: "open" as const, label: "Open", count: tasks.filter((t) => !t.is_done).length },
    { value: "in_progress" as const, label: "In progress", count: tasks.filter((t) => t.status === "in_progress").length },
    { value: "done" as const, label: "Done", count: tasks.filter((t) => t.is_done).length },
    { value: "all" as const, label: "All", count: tasks.length },
  ]);

  async function load() {
    const [t, p, m] = await Promise.all([getTasks(), getProjects(), getMilestones()]);
    // Archived projects and their tasks stay out of this page.
    projects = p.filter((project) => !isArchived(project));
    const shown = new Set(projects.map((project) => project.id));
    tasks = t.filter((task) => shown.has(task.project_id));
    milestones = m;
  }

  onMount(load);

  // ----- Task form -----
  let formOpen = $state(false);
  let editingId = $state<number | null>(null);
  let draft = $state<TaskInput>(emptyTask(0));

  function openNew() {
    editingId = null;
    const projectId = projectFilter === "all" ? (projects[0]?.id ?? 0) : projectFilter;
    draft = emptyTask(projectId);
    formOpen = true;
  }

  function openEdit(t: Task) {
    editingId = t.id;
    draft = {
      project_id: t.project_id,
      milestone_id: t.milestone_id,
      title: t.title,
      priority: t.priority,
      due_date: t.due_date,
      status: t.status,
    };
    formOpen = true;
  }

  async function save() {
    if (!draft.title.trim() || !draft.project_id) return;
    if (editingId === null) await addTask(draft);
    else await updateTask(editingId, draft);
    formOpen = false;
    await load();
  }

  async function toggle(t: Task) {
    await setTaskDone(t.id, !t.is_done);
    await load();
  }

  async function togglePlanned(t: Task) {
    await setTasksPlanned([t.id], t.planned_for === todayString() ? null : todayString());
    await load();
  }

  async function remove(t: Task) {
    await deleteTask(t.id);
    await load();
  }

  useShortcuts({ n: () => projects.length > 0 && openNew() });
</script>

<PageHeader title="Tasks" subtitle="All tasks across projects">
  {#snippet actions()}
    <button
      type="button"
      class="btn btn-primary"
      onclick={openNew}
      disabled={projects.length === 0}
      title={projects.length === 0 ? "Create a project first" : undefined}
    >
      <Icon name="plus" size={14} />New task
    </button>
  {/snippet}
</PageHeader>

<div class="space-y-4 px-8 py-6">
  <div class="flex flex-wrap items-center gap-3">
    <Tabs options={statusTabs} bind:value={statusFilter} />
    <select class="input w-36 py-1 text-xs" bind:value={priorityFilter} aria-label="Filter by priority">
      <option value="all">All priorities</option>
      {#each PRIORITIES as priority (priority)}
        <option value={priority}>{PRIORITY_LABELS[priority]}</option>
      {/each}
    </select>
    <select class="input w-48 py-1 text-xs" bind:value={projectFilter} aria-label="Filter by project">
      <option value="all">All projects</option>
      {#each projects as project (project.id)}
        <option value={project.id}>{project.name}</option>
      {/each}
    </select>
  </div>

  <div class="card divide-y divide-zinc-800/70">
    {#each visible as task (task.id)}
      <TaskRow {task} showProject ontoggle={toggle} onedit={openEdit} ondelete={remove} onplan={togglePlanned} />
    {:else}
      <EmptyState message={tasks.length === 0 ? "No tasks yet." : "No tasks match these filters."} />
    {/each}
  </div>
</div>

<Modal open={formOpen} title={editingId === null ? "New task" : "Edit task"} onclose={() => (formOpen = false)} onsubmit={save}>
  <TaskForm bind:values={draft} {projects} {milestones} />
</Modal>
