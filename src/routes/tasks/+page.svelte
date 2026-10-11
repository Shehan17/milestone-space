<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import { goto } from "$app/navigation";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import TaskForm, { defaultProjectId, emptyTask, rememberProject } from "$lib/components/TaskForm.svelte";
  import TaskRow from "$lib/components/TaskRow.svelte";
  import { addTask, deleteTask, getMilestones, getProjects, getTasks, setTaskDone, setTaskStatus, setTasksPlanned, updateTask } from "$lib/db";
  import { todayString } from "$lib/dates";
  import { ms } from "$lib/motion";
  import { isArchived } from "$lib/settings.svelte";
  import { useShortcuts } from "$lib/shortcuts.svelte";
  import { toast } from "$lib/toast.svelte";
  import { PRIORITIES, PRIORITY_LABELS, type Milestone, type Priority, type Project, type Task, type TaskInput } from "$lib/types";

  let tasks = $state<Task[]>([]);
  let projects = $state<Project[]>([]);
  let milestones = $state<Milestone[]>([]);
  let loaded = $state(false);

  type StatusFilter = "open" | "in_progress" | "done" | "all";
  let statusFilter = $state<StatusFilter>("open");
  let priorityFilter = $state<Priority | "all">("all");
  let projectFilter = $state<number | "all">("all");

  const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

  function matchesStatus(t: Task, filter: StatusFilter) {
    if (filter === "all") return true;
    if (filter === "in_progress") return t.status === "in_progress";
    return t.is_done === (filter === "done");
  }

  // Sorted by due date (no date last), then priority.
  let visible = $derived(
    tasks
      .filter((t) => matchesStatus(t, statusFilter))
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

  let filtered = $derived(statusFilter !== "open" || priorityFilter !== "all" || projectFilter !== "all");

  function clearFilters() {
    statusFilter = "open";
    priorityFilter = "all";
    projectFilter = "all";
  }

  async function load() {
    const [t, p, m] = await Promise.all([getTasks(), getProjects(), getMilestones()]);
    // Archived projects and their tasks stay out of this page.
    projects = p.filter((project) => !isArchived(project));
    const shown = new Set(projects.map((project) => project.id));
    tasks = t.filter((task) => shown.has(task.project_id));
    milestones = m;
    loaded = true;
  }

  onMount(load);

  // ----- Task form -----
  let formOpen = $state(false);
  let editingId = $state<number | null>(null);
  let draft = $state<TaskInput>(emptyTask(0));

  function openNew() {
    if (projects.length === 0) return;
    editingId = null;
    draft = emptyTask(projectFilter === "all" ? defaultProjectId(projects) : projectFilter);
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
    if (editingId === null) {
      await addTask(draft);
      rememberProject(draft.project_id);
      toast.success("Task added");
    } else {
      await updateTask(editingId, draft);
      toast.success("Task saved");
    }
    formOpen = false;
    await load();
  }

  async function toggle(t: Task) {
    const previous = t.status;
    await setTaskDone(t.id, !t.is_done);
    await load();
    // With a status filter the task leaves the list, so say where it went and offer Undo.
    if (!matchesStatus({ ...t, is_done: !t.is_done, status: t.is_done ? "todo" : "done" }, statusFilter)) {
      toast.undo(t.is_done ? "Task reopened" : "Task completed", async () => {
        await setTaskStatus(t.id, previous);
        await load();
      });
    }
  }

  async function togglePlanned(t: Task) {
    const planned = t.planned_for === todayString();
    await setTasksPlanned([t.id], planned ? null : todayString());
    await load();
    toast.success(planned ? "Removed from Today" : "Added to Today");
  }

  async function remove(t: Task) {
    const undo = await deleteTask(t.id);
    await load();
    toast.undo("Task deleted", async () => {
      await undo();
      await load();
    });
  }

  function deleteEditing() {
    const t = tasks.find((x) => x.id === editingId);
    formOpen = false;
    if (t) remove(t);
  }

  useShortcuts({ n: openNew });
</script>

<PageHeader title="Tasks" subtitle="All tasks across your projects">
  {#snippet actions()}
    <button
      type="button"
      class="btn btn-primary"
      onclick={openNew}
      disabled={loaded && projects.length === 0}
      title={projects.length === 0 ? "Create a project first" : "New task (N)"}
    >
      <Icon name="plus" size={14} />New task
    </button>
  {/snippet}
</PageHeader>

<div class="page space-y-4 py-6">
  <div class="flex flex-wrap items-center gap-3">
    <Tabs options={statusTabs} bind:value={statusFilter} label="Filter by status" />
    <select class="input input-sm w-36" bind:value={priorityFilter} aria-label="Filter by priority">
      <option value="all">All priorities</option>
      {#each PRIORITIES as priority (priority)}
        <option value={priority}>{PRIORITY_LABELS[priority]}</option>
      {/each}
    </select>
    <select class="input input-sm w-48" bind:value={projectFilter} aria-label="Filter by project">
      <option value="all">All projects</option>
      {#each projects as project (project.id)}
        <option value={project.id}>{project.name}</option>
      {/each}
    </select>
    {#if filtered}
      <button type="button" class="btn btn-ghost btn-sm" onclick={clearFilters}><Icon name="x" size={12} />Clear filters</button>
    {/if}
  </div>

  <div class="card divide-y divide-line">
    {#if !loaded}
      <Skeleton rows={4} />
    {:else}
      {#each visible as task (task.id)}
        <div animate:flip={{ duration: ms(200) }}>
          <TaskRow {task} showProject ontoggle={toggle} onedit={openEdit} ondelete={remove} onplan={togglePlanned} />
        </div>
      {:else}
        {#if projects.length === 0}
          <EmptyState
            icon="projects"
            message="Create a project first"
            hint="Tasks live in projects. Make one, then add its tasks here or on its page."
            action={{ label: "New project", icon: "plus", primary: true, onclick: () => goto("/projects?new=1") }}
          />
        {:else if tasks.length === 0}
          <EmptyState
            icon="tasks"
            message="No tasks yet"
            action={{ label: "Add your first task", icon: "plus", primary: true, onclick: openNew }}
          />
        {:else if statusFilter === "open" && !filtered}
          <EmptyState icon="check-circle" message="All done" hint="No open tasks left. Nice." />
        {:else}
          <EmptyState message="No tasks match these filters" action={{ label: "Clear filters", onclick: clearFilters }} />
        {/if}
      {/each}
    {/if}
  </div>
</div>

<Modal
  open={formOpen}
  title={editingId === null ? "New task" : "Edit task"}
  submitLabel={editingId === null ? "Add task" : "Save"}
  onclose={() => (formOpen = false)}
  onsubmit={save}
  ondelete={editingId === null ? undefined : deleteEditing}
>
  <TaskForm bind:values={draft} {projects} {milestones} />
</Modal>
