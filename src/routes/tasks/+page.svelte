<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import { goto } from "$app/navigation";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import FilterPills from "$lib/components/FilterPills.svelte";
  import ProjectDot from "$lib/components/ProjectDot.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import TaskForm, { defaultProjectId, emptyTask, rememberProject } from "$lib/components/TaskForm.svelte";
  import TaskRow from "$lib/components/TaskRow.svelte";
  import { addTask, deleteTask, getMilestones, getProjects, getTasks, setTaskDone, setTaskStatus, setTasksPlanned, updateTask } from "$lib/db";
  import { todayString } from "$lib/dates";
  import { ms } from "$lib/motion";
  import { onDataChanged } from "$lib/quickadd.svelte";
  import { isArchived } from "$lib/settings.svelte";
  import { useShortcuts } from "$lib/shortcuts.svelte";
  import { toast } from "$lib/toast.svelte";
  import { type Milestone, type Priority, type Project, type Task, type TaskInput } from "$lib/types";

  let tasks = $state<Task[]>([]);
  let projects = $state<Project[]>([]);
  let milestones = $state<Milestone[]>([]);
  let loaded = $state(false);

  type StatusFilter = "open" | "in_progress" | "today" | "high" | "done" | "all";
  let statusFilter = $state<StatusFilter>("open");
  /** A project's id, or "all". */
  let projectFilter = $state<number | "all">("all");

  const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

  function matchesStatus(t: Task, filter: StatusFilter) {
    switch (filter) {
      case "all":
        return true;
      case "in_progress":
        return t.status === "in_progress";
      case "today":
        return t.planned_for === todayString();
      case "high":
        return t.priority === "high" && !t.is_done;
      default:
        return t.is_done === (filter === "done");
    }
  }

  // Sorted by due date (no date last), then priority.
  let visible = $derived(
    tasks
      .filter((t) => matchesStatus(t, statusFilter))
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

  const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: "open", label: "Open" },
    { value: "in_progress", label: "In progress" },
    { value: "today", label: "In today's plan" },
    { value: "high", label: "High priority" },
    { value: "done", label: "Done" },
    { value: "all", label: "All" },
  ];

  let statusTabs = $derived(
    STATUS_FILTERS.map((f) => ({ ...f, count: tasks.filter((t) => matchesStatus(t, f.value)).length }))
  );

  /** One section per project, in the projects' order. */
  let groups = $derived(
    projects
      .map((p) => ({
        key: String(p.id),
        name: p.name,
        color: p.color,
        href: `/projects/${p.id}?tab=tasks`,
        tasks: visible.filter((t) => t.project_id === p.id),
      }))
      .filter((g) => g.tasks.length > 0)
  );

  let filtered = $derived(statusFilter !== "open" || projectFilter !== "all");

  function clearFilters() {
    statusFilter = "open";
    projectFilter = "all";
  }

  async function load() {
    const [t, p, m] = await Promise.all([getTasks(), getProjects(), getMilestones()]);
    // Archived projects and their tasks stay out of this page, and so do Misc tasks (they have their own page).
    projects = p.filter((project) => !isArchived(project));
    const shown = new Set(projects.map((project) => project.id));
    tasks = t.filter((task) => task.project_id !== null && shown.has(task.project_id));
    milestones = m;
    loaded = true;
  }

  onMount(load);
  onDataChanged(load);

  // ----- Task form -----
  let formOpen = $state(false);
  let editingId = $state<number | null>(null);
  let draft = $state<TaskInput>(emptyTask(null));

  function openNew() {
    editingId = null;
    const projectId = projectFilter === "all" ? defaultProjectId(projects) : projectFilter;
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
    if (!draft.title.trim()) return;
    if (editingId === null) {
      await addTask(draft);
      rememberProject(draft.project_id);
    } else {
      await updateTask(editingId, draft);
    }
    // A Misc task leaves this page, so say where it went.
    if (draft.project_id === null) {
      toast.success(editingId === null ? "Task added to Misc" : "Moved to Misc", { action: { label: "Open", run: () => goto("/misc") } });
    } else {
      toast.success(editingId === null ? "Task added" : "Task saved");
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

<PageHeader title="All tasks" subtitle="Every task from your projects. Use the sun to add one to today's plan.">
  {#snippet actions()}
    <button type="button" class="btn btn-primary btn-lg" onclick={openNew} title="New task (N)">
      <Icon name="plus" size={18} />New task
    </button>
  {/snippet}
</PageHeader>

<div class="page space-y-4.5 pt-5 pb-12">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <FilterPills options={statusTabs} bind:value={statusFilter} label="Filter by status" />
    <div class="flex items-center gap-2">
      {#if filtered}
        <button type="button" class="btn btn-ghost btn-sm" onclick={clearFilters}><Icon name="x" size={14} />Clear filters</button>
      {/if}
      <select class="input input-sm w-48" bind:value={projectFilter} aria-label="Filter by project">
        <option value="all">All projects</option>
        {#each projects as project (project.id)}
          <option value={project.id}>{project.name}</option>
        {/each}
      </select>
    </div>
  </div>

  {#if !loaded}
    <div class="card"><Skeleton rows={4} /></div>
  {:else}
    {#each groups as group (group.key)}
      <section class="card" aria-label={group.name}>
        <div class="flex items-center gap-2.5 px-5 py-3.5">
          <ProjectDot color={group.color} size={10} />
          <h2 class="min-w-0 flex-1 truncate text-sm font-semibold text-strong">
            {#if group.href}
              <a href={group.href} class="hover:text-accent-text-strong">{group.name}</a>
            {:else}
              {group.name}
            {/if}
          </h2>
          <span class="text-xs text-faint tabular-nums">{group.tasks.length}</span>
        </div>
        <div class="divide-y divide-line border-t border-line">
          {#each group.tasks as task (task.id)}
            <div animate:flip={{ duration: ms(200) }}>
              <TaskRow {task} ontoggle={toggle} onedit={openEdit} ondelete={remove} onplan={togglePlanned} />
            </div>
          {/each}
        </div>
      </section>
    {:else}
      <div class="card">
        {#if tasks.length === 0}
          <EmptyState
            icon="tasks"
            message="No tasks yet"
            hint="Add tasks to your projects. Small everyday jobs go in Misc."
            action={{ label: "Add your first task", icon: "plus", primary: true, onclick: openNew }}
          />
        {:else if statusFilter === "open" && !filtered}
          <EmptyState icon="check-circle" message="All done" hint="No open tasks left. Nice." />
        {:else}
          <EmptyState message="No tasks match these filters" action={{ label: "Clear filters", onclick: clearFilters }} />
        {/if}
      </div>
    {/each}
  {/if}
</div>

<Modal
  open={formOpen}
  title={editingId === null ? "New task" : "Edit task"}
  submitLabel={editingId === null ? "Add task" : "Save"}
  onclose={() => (formOpen = false)}
  onsubmit={save}
  ondelete={editingId === null ? undefined : deleteEditing}
>
  {#snippet aside()}
    {@const p = projects.find((x) => x.id === draft.project_id)}
    {#if p}<span class="flex min-w-0 items-center gap-1.5"><ProjectDot color={p.color} /><span class="truncate">{p.name}</span></span>{/if}
  {/snippet}
  <TaskForm bind:values={draft} {projects} {milestones} />
</Modal>
