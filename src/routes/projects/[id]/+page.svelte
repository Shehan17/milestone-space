<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import DeadlineLabel from "$lib/components/DeadlineLabel.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import MilestoneForm from "$lib/components/MilestoneForm.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import ProjectDetails from "$lib/components/ProjectDetails.svelte";
  import ProjectDot from "$lib/components/ProjectDot.svelte";
  import ProjectForm, { emptyProject } from "$lib/components/ProjectForm.svelte";
  import ProjectLinks from "$lib/components/ProjectLinks.svelte";
  import ProjectNotes from "$lib/components/ProjectNotes.svelte";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import TaskForm from "$lib/components/TaskForm.svelte";
  import TaskRow from "$lib/components/TaskRow.svelte";
  import {
    addMilestone,
    addTask,
    deleteMilestone,
    deleteProject,
    deleteTask,
    getClients,
    getMilestones,
    getProject,
    getTasks,
    setMilestoneDone,
    setProjectPinned,
    setTaskDone,
    updateMilestone,
    updateProject,
    updateTask,
  } from "$lib/db";
  import {
    TYPE_LABELS,
    type Client,
    type Milestone,
    type MilestoneInput,
    type Project,
    type ProjectInput,
    type Task,
    type TaskInput,
  } from "$lib/types";

  let projectId = $derived(Number(page.params.id));

  let project = $state<Project | null>(null);
  let milestones = $state<Milestone[]>([]);
  let tasks = $state<Task[]>([]);
  let clients = $state<Client[]>([]);
  let loaded = $state(false);

  async function load(id: number) {
    const [p, m, t] = await Promise.all([getProject(id), getMilestones(id), getTasks(id)]);
    project = p;
    milestones = m;
    tasks = t;
    loaded = true;
  }

  const reload = () => load(projectId);

  $effect(() => {
    load(projectId);
  });

  let doneTasks = $derived(tasks.filter((t) => t.is_done).length);
  let doneMilestones = $derived(milestones.filter((m) => m.is_done).length);

  type Tab = "overview" | "tasks" | "milestones" | "info";
  let tab = $state<Tab>("overview");

  /** Open tasks and milestones with a due date, nearest first (overdue ones lead). */
  type UpcomingItem = { kind: "task"; item: Task } | { kind: "milestone"; item: Milestone };
  let upcoming = $derived(
    [
      ...tasks.map((item): UpcomingItem => ({ kind: "task", item })),
      ...milestones.map((item): UpcomingItem => ({ kind: "milestone", item })),
    ]
      .filter((u) => !u.item.is_done && u.item.due_date)
      .sort((a, b) => a.item.due_date!.localeCompare(b.item.due_date!))
  );

  /** The nearest open date: the project deadline or an upcoming item, whichever comes first. */
  let nextDeadline = $derived.by(() => {
    const first = upcoming[0];
    const projectDue = project && project.status !== "completed" ? project.deadline : null;
    if (projectDue && (!first || projectDue <= first.item.due_date!)) {
      return { title: "Project deadline", date: projectDue };
    }
    return first ? { title: first.item.title, date: first.item.due_date } : null;
  });

  function toggleUpcoming(u: UpcomingItem) {
    return u.kind === "task" ? toggleTask(u.item) : toggleMilestone(u.item);
  }

  function milestoneProgress(milestoneId: number) {
    const linked = tasks.filter((t) => t.milestone_id === milestoneId);
    return { done: linked.filter((t) => t.is_done).length, total: linked.length };
  }

  // ----- Project edit / delete -----
  let projectFormOpen = $state(false);
  let projectDraft = $state<ProjectInput>(emptyProject());
  let confirmProjectDelete = $state(false);

  async function openProjectEdit() {
    if (!project) return;
    clients = await getClients();
    projectDraft = {
      type: project.type,
      client_id: project.client_id,
      name: project.name,
      description: project.description,
      status: project.status,
      deadline: project.deadline,
      color: project.color,
    };
    projectFormOpen = true;
  }

  async function saveProject() {
    if (!projectDraft.name.trim()) return;
    if (projectDraft.type === "client" && projectDraft.client_id === null) return;
    await updateProject(projectId, projectDraft);
    projectFormOpen = false;
    await reload();
  }

  async function togglePinned() {
    if (!project) return;
    await setProjectPinned(projectId, !project.pinned_at);
    await reload();
  }

  async function removeProject() {
    await deleteProject(projectId);
    await goto("/projects");
  }

  // ----- Milestones -----
  let milestoneFormOpen = $state(false);
  let editingMilestoneId = $state<number | null>(null);
  let milestoneDraft = $state<MilestoneInput>({ project_id: 0, title: "", description: "", due_date: null });
  let milestoneToDelete = $state<Milestone | null>(null);

  function openNewMilestone() {
    editingMilestoneId = null;
    milestoneDraft = { project_id: projectId, title: "", description: "", due_date: null };
    milestoneFormOpen = true;
  }

  function openEditMilestone(m: Milestone) {
    editingMilestoneId = m.id;
    milestoneDraft = { project_id: m.project_id, title: m.title, description: m.description, due_date: m.due_date };
    milestoneFormOpen = true;
  }

  async function saveMilestone() {
    if (!milestoneDraft.title.trim()) return;
    if (editingMilestoneId === null) await addMilestone(milestoneDraft);
    else await updateMilestone(editingMilestoneId, milestoneDraft);
    milestoneFormOpen = false;
    await reload();
  }

  async function toggleMilestone(m: Milestone) {
    await setMilestoneDone(m.id, !m.is_done);
    await reload();
  }

  async function removeMilestone() {
    if (!milestoneToDelete) return;
    await deleteMilestone(milestoneToDelete.id);
    milestoneToDelete = null;
    await reload();
  }

  // ----- Tasks -----
  let taskFormOpen = $state(false);
  let editingTaskId = $state<number | null>(null);
  let taskDraft = $state<TaskInput>({ project_id: 0, milestone_id: null, title: "", priority: "medium", due_date: null });

  function openNewTask(milestoneId: number | null = null) {
    editingTaskId = null;
    taskDraft = { project_id: projectId, milestone_id: milestoneId, title: "", priority: "medium", due_date: null };
    taskFormOpen = true;
  }

  function openEditTask(t: Task) {
    editingTaskId = t.id;
    taskDraft = {
      project_id: t.project_id,
      milestone_id: t.milestone_id,
      title: t.title,
      priority: t.priority,
      due_date: t.due_date,
    };
    taskFormOpen = true;
  }

  async function saveTask() {
    if (!taskDraft.title.trim()) return;
    if (editingTaskId === null) await addTask(taskDraft);
    else await updateTask(editingTaskId, taskDraft);
    taskFormOpen = false;
    await reload();
  }

  async function toggleTask(t: Task) {
    await setTaskDone(t.id, !t.is_done);
    await reload();
  }

  async function removeTask(t: Task) {
    await deleteTask(t.id);
    await reload();
  }
</script>

<div class="flex min-h-14 items-center gap-2 border-b border-zinc-800/80 px-8 py-3">
  <a href="/projects" class="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-200">
    <Icon name="back" size={14} />Projects
  </a>
  {#if project}
    <span class="text-zinc-700">/</span>
    <ProjectDot color={project.color} />
    <span class="truncate text-sm text-zinc-300">{project.name}</span>
    <div class="ml-auto flex gap-2">
      <button
        type="button"
        class="btn btn-ghost {project.pinned_at ? 'text-violet-400' : ''}"
        title={project.pinned_at ? "Remove from the dashboard" : "Show on the dashboard"}
        onclick={togglePinned}
      >
        <Icon name="pin" size={14} />{project.pinned_at ? "Pinned" : "Pin"}
      </button>
      <button type="button" class="btn btn-ghost" onclick={openProjectEdit}><Icon name="edit" size={14} />Edit</button>
      <button type="button" class="btn btn-ghost hover:text-red-400" onclick={() => (confirmProjectDelete = true)}>
        <Icon name="trash" size={14} />Delete
      </button>
    </div>
  {/if}
</div>

{#if project}
  <div class="space-y-5 px-8 py-6">
    <Tabs
      options={[
        { value: "overview", label: "Overview" },
        { value: "tasks", label: "Tasks", count: tasks.length },
        { value: "milestones", label: "Milestones", count: milestones.length },
        { value: "info", label: "Info" },
      ]}
      bind:value={tab}
    />

    {#if tab === "overview"}
      <!-- Project info -->
      <section class="card p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <h1 class="flex items-center gap-2.5 text-lg font-semibold text-zinc-100">
              <ProjectDot color={project.color} size={10} />{project.name}
            </h1>
            <p class="text-sm text-zinc-500">
              {TYPE_LABELS[project.type]}{#if project.client_name}&nbsp;· {project.client_name}{/if}
            </p>
          </div>
          <StatusBadge status={project.status} />
        </div>
        {#if project.description}
          <p class="mt-3 text-sm whitespace-pre-line text-zinc-400">{project.description}</p>
        {/if}
        <div class="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
          Deadline: <DeadlineLabel date={project.deadline} done={project.status === "completed"} />
        </div>
      </section>

      <div class="grid gap-4 sm:grid-cols-3">
        <div class="card px-4 py-3">
          <p class="text-xs text-zinc-500">Progress</p>
          <p class="mt-1 text-2xl font-semibold text-zinc-100 tabular-nums">
            {doneTasks}<span class="text-base text-zinc-500">/{tasks.length}</span>
            <span class="text-xs font-normal text-zinc-500">tasks done</span>
          </p>
          <div class="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              class="h-full bg-violet-500"
              style="width: {tasks.length ? (doneTasks / tasks.length) * 100 : 0}%"
            ></div>
          </div>
        </div>
        <div class="card px-4 py-3">
          <p class="text-xs text-zinc-500">Milestones</p>
          <p class="mt-1 text-2xl font-semibold text-zinc-100 tabular-nums">
            {doneMilestones}<span class="text-base text-zinc-500">/{milestones.length}</span>
            <span class="text-xs font-normal text-zinc-500">reached</span>
          </p>
        </div>
        <div class="card min-w-0 px-4 py-3">
          <p class="text-xs text-zinc-500">Next deadline</p>
          {#if nextDeadline}
            <p class="mt-1 truncate text-sm font-medium text-zinc-100">{nextDeadline.title}</p>
            <DeadlineLabel date={nextDeadline.date} />
          {:else}
            <p class="mt-1 text-sm text-zinc-500">Nothing scheduled</p>
          {/if}
        </div>
      </div>

      <section class="card">
        <div class="border-b border-zinc-800 px-4 py-2">
          <h2 class="text-xs font-semibold text-zinc-300">Up next</h2>
        </div>
        {#each upcoming.slice(0, 3) as u (u.kind + u.item.id)}
          <div class="flex items-center gap-3 px-4 py-2 hover:bg-zinc-800/30">
            <input
              type="checkbox"
              class="checkbox"
              checked={false}
              onchange={() => toggleUpcoming(u)}
              aria-label="Mark {u.item.title} as done"
            />
            <span class="shrink-0 text-zinc-500" title={u.kind === "task" ? "Task" : "Milestone"}>
              <Icon name={u.kind === "task" ? "tasks" : "flag"} size={14} />
            </span>
            <button
              type="button"
              class="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-zinc-200 hover:text-violet-300"
              onclick={() => (tab = u.kind === "task" ? "tasks" : "milestones")}
            >
              {u.item.title}
            </button>
            <DeadlineLabel date={u.item.due_date} />
          </div>
        {:else}
          <EmptyState message="No upcoming tasks or milestones with a due date." />
        {/each}
      </section>
    {:else if tab === "milestones"}
      <section class="card">
        <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
          <h2 class="text-xs font-semibold text-zinc-300">Milestones <span class="ml-1 text-zinc-500">{milestones.length}</span></h2>
          <button type="button" class="btn btn-ghost px-2 py-1 text-xs" onclick={openNewMilestone}>
            <Icon name="plus" size={12} />Add milestone
          </button>
        </div>
        {#each milestones as m (m.id)}
          {@const progress = milestoneProgress(m.id)}
          <div class="group flex items-center gap-3 px-4 py-2 hover:bg-zinc-800/30">
            <input
              type="checkbox"
              class="checkbox"
              checked={m.is_done}
              onchange={() => toggleMilestone(m)}
              aria-label="Mark {m.title} as done"
            />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm {m.is_done ? 'text-zinc-500 line-through' : 'text-zinc-200'}">{m.title}</p>
              {#if m.description}
                <p class="truncate text-xs text-zinc-500">{m.description}</p>
              {/if}
            </div>
            <span class="w-16 shrink-0 text-xs text-zinc-500 tabular-nums">
              {#if progress.total > 0}{progress.done}/{progress.total} tasks{/if}
            </span>
            <div class="w-28 shrink-0 text-right"><DeadlineLabel date={m.due_date} done={m.is_done} /></div>
            <div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
              <button type="button" class="icon-btn" aria-label="Add task to milestone" onclick={() => openNewTask(m.id)}>
                <Icon name="plus" size={14} />
              </button>
              <button type="button" class="icon-btn" aria-label="Edit milestone" onclick={() => openEditMilestone(m)}>
                <Icon name="edit" size={14} />
              </button>
              <button
                type="button"
                class="icon-btn hover:text-red-400"
                aria-label="Delete milestone"
                onclick={() => (milestoneToDelete = m)}
              >
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
        {:else}
          <EmptyState message="No milestones yet." />
        {/each}
      </section>

    {:else if tab === "tasks"}
      <section class="card">
        <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
          <h2 class="text-xs font-semibold text-zinc-300">Tasks <span class="ml-1 text-zinc-500">{tasks.length}</span></h2>
          <button type="button" class="btn btn-ghost px-2 py-1 text-xs" onclick={() => openNewTask()}>
            <Icon name="plus" size={12} />Add task
          </button>
        </div>
        {#each tasks as task (task.id)}
          <TaskRow {task} ontoggle={toggleTask} onedit={openEditTask} ondelete={removeTask} />
        {:else}
          <EmptyState message="No tasks yet." />
        {/each}
      </section>
    {:else}
      <ProjectNotes {projectId} />
      <div class="grid gap-5 lg:grid-cols-2">
        <ProjectLinks {projectId} />
        <ProjectDetails {projectId} />
      </div>
    {/if}
  </div>
{:else if loaded}
  <EmptyState message="Project not found." />
{/if}

<Modal open={projectFormOpen} title="Edit project" onclose={() => (projectFormOpen = false)} onsubmit={saveProject}>
  <ProjectForm bind:values={projectDraft} {clients} />
</Modal>

<Modal
  open={confirmProjectDelete}
  title="Delete project"
  submitLabel="Delete"
  danger
  onclose={() => (confirmProjectDelete = false)}
  onsubmit={removeProject}
>
  <p class="text-sm text-zinc-300">
    Delete <span class="font-medium text-zinc-100">{project?.name}</span> with all its milestones and tasks?
  </p>
</Modal>

<Modal
  open={milestoneFormOpen}
  title={editingMilestoneId === null ? "New milestone" : "Edit milestone"}
  onclose={() => (milestoneFormOpen = false)}
  onsubmit={saveMilestone}
>
  <MilestoneForm bind:values={milestoneDraft} />
</Modal>

<Modal
  open={milestoneToDelete !== null}
  title="Delete milestone"
  submitLabel="Delete"
  danger
  onclose={() => (milestoneToDelete = null)}
  onsubmit={removeMilestone}
>
  <p class="text-sm text-zinc-300">
    Delete <span class="font-medium text-zinc-100">{milestoneToDelete?.title}</span>? Its tasks are kept but
    unlinked from the milestone.
  </p>
</Modal>

<Modal
  open={taskFormOpen}
  title={editingTaskId === null ? "New task" : "Edit task"}
  onclose={() => (taskFormOpen = false)}
  onsubmit={saveTask}
>
  <TaskForm bind:values={taskDraft} {milestones} />
</Modal>
