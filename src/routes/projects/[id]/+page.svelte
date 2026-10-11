<script lang="ts">
  import { untrack } from "svelte";
  import { flip } from "svelte/animate";
  import { goto, replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import DeadlineLabel from "$lib/components/DeadlineLabel.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import MilestoneForm from "$lib/components/MilestoneForm.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import ProjectDetails from "$lib/components/ProjectDetails.svelte";
  import ProjectDot from "$lib/components/ProjectDot.svelte";
  import ProjectForm, { emptyProject } from "$lib/components/ProjectForm.svelte";
  import ProjectLinks from "$lib/components/ProjectLinks.svelte";
  import ProjectNotes from "$lib/components/ProjectNotes.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import TaskBoard from "$lib/components/TaskBoard.svelte";
  import TaskForm, { emptyTask } from "$lib/components/TaskForm.svelte";
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
    moveTaskOnBoard,
    setMilestoneDone,
    setProjectPinned,
    setTaskDone,
    setTaskStatus,
    setTasksPlanned,
    updateMilestone,
    updateProject,
    updateTask,
  } from "$lib/db";
  import { todayString } from "$lib/dates";
  import { ms } from "$lib/motion";
  import { openFolder, openInVsCode } from "$lib/system";
  import { useShortcuts } from "$lib/shortcuts.svelte";
  import { toast } from "$lib/toast.svelte";
  import {
    TYPE_LABELS,
    type Client,
    type Milestone,
    type MilestoneInput,
    type Project,
    type ProjectInput,
    type Task,
    type TaskInput,
    type TaskStatus,
  } from "$lib/types";

  let projectId = $derived(Number(page.params.id));

  let project = $state<Project | null>(null);
  let milestones = $state<Milestone[]>([]);
  let tasks = $state<Task[]>([]);
  let clients = $state<Client[]>([]);
  let loaded = $state(false);

  async function load(id: number) {
    const [p, m, t] = await Promise.all([getProject(id), getMilestones(id), getTasks(id)]);
    if (id !== project?.id) {
      // Another project: its own tab and view, and no filter carried over.
      tab = readTab(id);
      taskView = readTaskView(id);
      milestoneFilter = "all";
    }
    project = p;
    milestones = m;
    tasks = t;
    loaded = true;
  }

  const reload = () => load(projectId);

  $effect(() => {
    const id = projectId;
    untrack(() => load(id));
  });

  let doneTasks = $derived(tasks.filter((t) => t.is_done).length);
  let doneMilestones = $derived(milestones.filter((m) => m.is_done).length);

  // ----- Tabs: in the address (?tab=tasks, so links can open one and Back returns to it),
  // and remembered per project (a display preference, so localStorage). -----
  type Tab = "overview" | "tasks" | "milestones" | "info";
  const TABS: Tab[] = ["overview", "tasks", "milestones", "info"];
  let tab = $state<Tab>("overview");

  const tabKey = (id: number) => `milestonespace.projectTab.${id}`;
  const isTab = (value: unknown): value is Tab => TABS.includes(value as Tab);

  function readTab(id: number): Tab {
    const fromUrl = page.url.searchParams.get("tab");
    if (isTab(fromUrl)) return fromUrl;
    try {
      const stored = localStorage.getItem(tabKey(id));
      if (isTab(stored)) return stored;
    } catch {
      // Not remembered: start on the overview.
    }
    return "overview";
  }

  function setTab(next: Tab) {
    tab = next;
    try {
      localStorage.setItem(tabKey(projectId), next);
    } catch {
      // Still shown until the page is left.
    }
    const url = new URL(page.url);
    url.searchParams.set("tab", next);
    replaceState(url, {});
  }

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

  /** Checking an item in Up next makes it disappear, so it comes with Undo. */
  async function completeUpcoming(u: UpcomingItem) {
    if (u.kind === "task") {
      const { id, status } = u.item;
      await setTaskDone(id, true);
      await reload();
      toast.undo("Task completed", async () => {
        await setTaskStatus(id, status);
        await reload();
      });
    } else {
      const { id } = u.item;
      await setMilestoneDone(id, true);
      await reload();
      toast.undo("Milestone reached", async () => {
        await setMilestoneDone(id, false);
        await reload();
      });
    }
  }

  function milestoneProgress(milestoneId: number) {
    const linked = tasks.filter((t) => t.milestone_id === milestoneId);
    return { done: linked.filter((t) => t.is_done).length, total: linked.length };
  }

  let openMilestones = $derived(milestones.filter((m) => !m.is_done));

  async function openPath(action: (path: string) => Promise<void>, path: string) {
    try {
      await action(path);
    } catch (e) {
      toast.error(`Couldn't open ${path}`, e);
    }
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
      local_path: project.local_path,
    };
    projectFormOpen = true;
  }

  async function saveProject() {
    if (!projectDraft.name.trim()) return;
    if (projectDraft.type === "client" && projectDraft.client_id === null) return;
    await updateProject(projectId, projectDraft);
    projectFormOpen = false;
    toast.success("Project saved");
    await reload();
  }

  async function togglePinned() {
    if (!project) return;
    const wasPinned = !!project.pinned_at;
    await setProjectPinned(projectId, !wasPinned);
    await reload();
    toast.success(wasPinned ? "Unpinned from the Dashboard" : "Pinned to the Dashboard");
  }

  async function removeProject() {
    const name = project?.name ?? "Project";
    await deleteProject(projectId);
    confirmProjectDelete = false;
    toast.success(`“${name}” deleted`);
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
    toast.success(editingMilestoneId === null ? "Milestone added" : "Milestone saved");
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
    toast.success(`Milestone “${milestoneToDelete.title}” deleted`);
    milestoneToDelete = null;
    await reload();
  }

  // ----- Tasks: list or board, optionally one milestone -----
  type TaskView = "list" | "board";
  let taskView = $state<TaskView>("list");
  let milestoneFilter = $state<number | "none" | "all">("all");

  // The list/board choice is remembered per project (a display preference, so localStorage).
  const viewKey = (id: number) => `milestonespace.taskView.${id}`;

  function readTaskView(id: number): TaskView {
    try {
      return localStorage.getItem(viewKey(id)) === "board" ? "board" : "list";
    } catch {
      return "list";
    }
  }

  function setTaskView(view: TaskView) {
    taskView = view;
    try {
      localStorage.setItem(viewKey(projectId), view);
    } catch {
      // Still applied until the page is left.
    }
  }

  let visibleTasks = $derived(
    milestoneFilter === "all"
      ? tasks
      : tasks.filter((t) => t.milestone_id === (milestoneFilter === "none" ? null : milestoneFilter))
  );

  /** Drag and drop: show the move right away, then save and reload. */
  async function moveTask(task: Task, status: TaskStatus, orderedIds: number[]) {
    tasks = tasks.map((t) => {
      const order = orderedIds.indexOf(t.id);
      if (t.id === task.id) return { ...t, status, is_done: status === "done", board_order: order };
      return order === -1 ? t : { ...t, board_order: order };
    });
    await moveTaskOnBoard(task.id, status, orderedIds);
    await reload();
  }

  let taskFormOpen = $state(false);
  let editingTaskId = $state<number | null>(null);
  let taskDraft = $state<TaskInput>(emptyTask(0));

  /** New tasks go into the filtered milestone, and the board column they were added from. */
  function openNewTask(
    milestoneId: number | null = typeof milestoneFilter === "number" ? milestoneFilter : null,
    status: TaskStatus = "todo"
  ) {
    editingTaskId = null;
    taskDraft = emptyTask(projectId, { milestone_id: milestoneId, status });
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
      status: t.status,
    };
    taskFormOpen = true;
  }

  async function saveTask() {
    if (!taskDraft.title.trim()) return;
    if (editingTaskId === null) await addTask(taskDraft);
    else await updateTask(editingTaskId, taskDraft);
    toast.success(editingTaskId === null ? "Task added" : "Task saved");
    taskFormOpen = false;
    await reload();
  }

  async function toggleTask(t: Task) {
    await setTaskDone(t.id, !t.is_done);
    await reload();
  }

  async function togglePlanned(t: Task) {
    const planned = t.planned_for === todayString();
    await setTasksPlanned([t.id], planned ? null : todayString());
    await reload();
    toast.success(planned ? "Removed from Today" : "Added to Today");
  }

  async function removeTask(t: Task) {
    const undo = await deleteTask(t.id);
    await reload();
    toast.undo("Task deleted", async () => {
      await undo();
      await reload();
    });
  }

  function deleteEditingTask() {
    const t = tasks.find((x) => x.id === editingTaskId);
    taskFormOpen = false;
    if (t) removeTask(t);
  }

  useShortcuts({
    n: () => openNewTask(),
    m: openNewMilestone,
    e: openProjectEdit,
    o: () => project?.local_path && openPath(openFolder, project.local_path),
    v: () => project?.local_path && openPath(openInVsCode, project.local_path),
    "1": () => setTab("overview"),
    "2": () => setTab("tasks"),
    "3": () => setTab("milestones"),
    "4": () => setTab("info"),
    b: () => {
      setTab("tasks");
      setTaskView(taskView === "board" ? "list" : "board");
    },
  });
</script>

{#snippet milestoneRow(m: Milestone, actions: boolean)}
  {@const progress = milestoneProgress(m.id)}
  <div class="group list-row">
    <input
      type="checkbox"
      class="checkbox"
      checked={m.is_done}
      onchange={() => toggleMilestone(m)}
      aria-label="Mark {m.title} as reached"
    />
    <button type="button" class="min-w-0 flex-1 cursor-pointer text-left" onclick={() => openEditMilestone(m)}>
      <p class="truncate text-sm {m.is_done ? 'text-faint line-through' : 'text-fg'}">{m.title}</p>
      {#if m.description}
        <p class="truncate text-xs text-faint">{m.description}</p>
      {/if}
    </button>
    <div class="hidden w-32 shrink-0 items-center gap-2 md:flex">
      {#if progress.total > 0}
        <ProgressBar done={progress.done} total={progress.total} />
        <span class="text-xs text-faint tabular-nums">{progress.done}/{progress.total}</span>
      {/if}
    </div>
    <div class="w-24 shrink-0 text-right"><DeadlineLabel date={m.due_date} done={m.is_done} /></div>
    {#if actions}
      <div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <button type="button" class="icon-btn" aria-label="Add task to {m.title}" title="Add task" onclick={() => openNewTask(m.id)}>
          <Icon name="plus" size={14} />
        </button>
        <button type="button" class="icon-btn" aria-label="Edit milestone" title="Edit" onclick={() => openEditMilestone(m)}>
          <Icon name="edit" size={14} />
        </button>
        <button
          type="button"
          class="icon-btn icon-btn-danger"
          aria-label="Delete milestone"
          title="Delete"
          onclick={() => (milestoneToDelete = m)}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    {/if}
  </div>
{/snippet}

<PageHeader title={project?.name ?? ""}>
  {#snippet leading()}
    <a href="/projects" class="icon-btn -ml-1.5" aria-label="Back to Projects" title="Back to Projects">
      <Icon name="back" size={18} />
    </a>
    {#if project}<ProjectDot color={project.color} size={10} />{/if}
  {/snippet}
  {#snippet meta()}
    {#if project}
      <p class="flex min-w-0 items-center gap-2 text-xs text-faint">
        <span class="truncate">
          {TYPE_LABELS[project.type]}{#if project.client_name}&nbsp;· {project.client_name}{/if}
        </span>
        <StatusBadge status={project.status} />
        {#if project.deadline}
          <span class="inline-flex shrink-0 items-center gap-1" title="Project deadline">
            <Icon name="calendar" size={12} /><DeadlineLabel date={project.deadline} done={project.status === "completed"} />
          </span>
        {/if}
      </p>
    {/if}
  {/snippet}
  {#snippet actions()}
    {#if project}
      {#if project.local_path}
        {@const path = project.local_path}
        <button type="button" class="btn btn-ghost px-2 xl:px-3" title="Open {path} in Explorer (O)" onclick={() => openPath(openFolder, path)}>
          <Icon name="folder" size={14} /><span class="hidden xl:inline">Open folder</span>
        </button>
        <button type="button" class="btn btn-ghost px-2 xl:px-3" title="Open {path} in VS Code (V)" onclick={() => openPath(openInVsCode, path)}>
          <Icon name="code" size={14} /><span class="hidden xl:inline">VS Code</span>
        </button>
      {/if}
      <button
        type="button"
        class="btn btn-ghost px-2 xl:px-3 {project.pinned_at ? 'text-accent-text' : ''}"
        title={project.pinned_at ? "Remove from the Dashboard" : "Show on the Dashboard"}
        aria-pressed={!!project.pinned_at}
        onclick={togglePinned}
      >
        <Icon name="pin" size={14} /><span class="hidden xl:inline">{project.pinned_at ? "Pinned" : "Pin"}</span>
      </button>
      <button type="button" class="btn btn-secondary" title="Edit project (E)" onclick={openProjectEdit}>
        <Icon name="edit" size={14} />Edit
      </button>
    {/if}
  {/snippet}
</PageHeader>

{#if project}
  <div class="page space-y-5 py-6">
    <Tabs
      options={[
        { value: "overview", label: "Overview" },
        { value: "tasks", label: "Tasks", count: tasks.length },
        { value: "milestones", label: "Milestones", count: milestones.length },
        { value: "info", label: "Info" },
      ]}
      value={tab}
      onchange={setTab}
      label="Project sections"
    />

    {#if tab === "overview"}
      <div class="grid gap-3 sm:grid-cols-3">
        <div class="card px-4 py-3">
          <p class="text-xs text-faint">Tasks done</p>
          <p class="mt-1 text-2xl font-semibold text-strong tabular-nums">
            {doneTasks}<span class="text-base font-normal text-faint">/{tasks.length}</span>
          </p>
          <div class="mt-2 flex"><ProgressBar done={doneTasks} total={tasks.length} color={project.color} /></div>
        </div>
        <div class="card px-4 py-3">
          <p class="text-xs text-faint">Milestones reached</p>
          <p class="mt-1 text-2xl font-semibold text-strong tabular-nums">
            {doneMilestones}<span class="text-base font-normal text-faint">/{milestones.length}</span>
          </p>
          <div class="mt-2 flex"><ProgressBar done={doneMilestones} total={milestones.length} /></div>
        </div>
        <div class="card min-w-0 px-4 py-3">
          <p class="text-xs text-faint">Next deadline</p>
          {#if nextDeadline}
            <p class="mt-1 truncate text-sm font-medium text-strong">{nextDeadline.title}</p>
            <DeadlineLabel date={nextDeadline.date} />
          {:else}
            <p class="mt-1 text-sm text-faint">Nothing scheduled</p>
          {/if}
        </div>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Up next</h2>
            <button type="button" class="btn btn-ghost btn-sm" onclick={() => setTab("tasks")}>All tasks</button>
          </div>
          <div class="divide-y divide-line">
            {#each upcoming.slice(0, 5) as u (u.kind + u.item.id)}
              <div class="list-row">
                <input
                  type="checkbox"
                  class="checkbox"
                  checked={false}
                  onchange={() => completeUpcoming(u)}
                  aria-label="Mark {u.item.title} as done"
                />
                <span class="text-faint" title={u.kind === "task" ? "Task" : "Milestone"}>
                  <Icon name={u.kind === "task" ? "tasks" : "flag"} size={14} />
                </span>
                <button
                  type="button"
                  class="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-fg hover:text-accent-text-strong"
                  onclick={() => (u.kind === "task" ? openEditTask(u.item) : openEditMilestone(u.item))}
                >
                  {u.item.title}
                </button>
                <DeadlineLabel date={u.item.due_date} />
              </div>
            {:else}
              <EmptyState
                compact
                icon="calendar"
                message="Nothing scheduled"
                hint="Tasks and milestones with a due date show up here, nearest first."
                action={{ label: "Add task", icon: "plus", onclick: () => openNewTask() }}
              />
            {/each}
          </div>
        </section>

        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Milestones <span class="count">{doneMilestones}/{milestones.length}</span></h2>
            <button type="button" class="btn btn-ghost btn-sm" onclick={() => setTab("milestones")}>All milestones</button>
          </div>
          <div class="divide-y divide-line">
            {#each openMilestones.slice(0, 5) as m (m.id)}
              {@render milestoneRow(m, false)}
            {:else}
              <EmptyState
                compact
                icon="flag"
                message={milestones.length ? "Every milestone is reached" : "No milestones yet"}
                hint={milestones.length ? undefined : "Split the project into steps, each with its own due date."}
                action={{ label: "Add milestone", icon: "plus", onclick: openNewMilestone }}
              />
            {/each}
          </div>
        </section>
      </div>

      <section class="card px-4 py-3">
        <h2 class="card-title mb-1.5">About</h2>
        {#if project.description}
          <p class="text-sm whitespace-pre-line text-fg">{project.description}</p>
        {:else}
          <button type="button" class="link text-sm" onclick={openProjectEdit}>Add a description</button>
        {/if}
        <div class="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-3 text-xs text-faint">
          <span>Deadline: <DeadlineLabel date={project.deadline} done={project.status === "completed"} empty="none" /></span>
          <span class="min-w-0 truncate">
            Folder:
            {#if project.local_path}
              <span class="font-mono text-muted">{project.local_path}</span>
            {:else}
              <button type="button" class="link" onclick={openProjectEdit}>Set a folder</button>
            {/if}
          </span>
        </div>
      </section>
    {:else if tab === "milestones"}
      <section class="card">
        <div class="card-header">
          <h2 class="card-title">Milestones <span class="count">{milestones.length}</span></h2>
          <button type="button" class="btn btn-ghost btn-sm" onclick={openNewMilestone} title="New milestone (M)">
            <Icon name="plus" size={12} />Add milestone
          </button>
        </div>
        <div class="divide-y divide-line">
          {#each milestones as m (m.id)}
            {@render milestoneRow(m, true)}
          {:else}
            <EmptyState
              icon="flag"
              message="No milestones yet"
              hint="Milestones split a project into steps, each with its own due date and tasks."
              action={{ label: "Add milestone", icon: "plus", primary: true, onclick: openNewMilestone }}
            />
          {/each}
        </div>
      </section>
    {:else if tab === "tasks"}
      <div class="flex flex-wrap items-center gap-3">
        <Tabs
          options={[
            { value: "list", label: "List", icon: "list" },
            { value: "board", label: "Board", icon: "board" },
          ]}
          value={taskView}
          onchange={setTaskView}
          label="Task view"
        />
        {#if milestones.length > 0}
          <select class="input input-sm w-52" bind:value={milestoneFilter} aria-label="Filter by milestone">
            <option value="all">All milestones</option>
            {#each milestones as m (m.id)}
              <option value={m.id}>{m.title}</option>
            {/each}
            <option value="none">No milestone</option>
          </select>
        {/if}
        <button type="button" class="btn btn-primary btn-sm ml-auto" onclick={() => openNewTask()} title="New task (N)">
          <Icon name="plus" size={12} />Add task
        </button>
      </div>

      {#if taskView === "board"}
        <TaskBoard
          tasks={visibleTasks}
          onmove={moveTask}
          onedit={openEditTask}
          onadd={(status) => openNewTask(undefined, status)}
          ondelete={removeTask}
        />
      {:else}
        <section class="card">
          <div class="card-header">
            <h2 class="card-title">Tasks <span class="count">{visibleTasks.length}</span></h2>
            {#if visibleTasks.length > 0}
              <span class="text-xs text-faint tabular-nums">{visibleTasks.filter((t) => t.is_done).length} done</span>
            {/if}
          </div>
          <div class="divide-y divide-line">
            {#each visibleTasks as task (task.id)}
              <div animate:flip={{ duration: ms(200) }}>
                <TaskRow {task} ontoggle={toggleTask} onedit={openEditTask} ondelete={removeTask} onplan={togglePlanned} />
              </div>
            {:else}
              {#if tasks.length === 0}
                <EmptyState
                  icon="tasks"
                  message="No tasks yet"
                  hint="Break the project into tasks you can check off."
                  action={{ label: "Add your first task", icon: "plus", primary: true, onclick: () => openNewTask() }}
                />
              {:else}
                <EmptyState
                  message="No tasks in this milestone"
                  action={{ label: "Show all tasks", onclick: () => (milestoneFilter = "all") }}
                />
              {/if}
            {/each}
          </div>
        </section>
      {/if}
    {:else}
      <ProjectNotes {projectId} />
      <div class="grid gap-5 lg:grid-cols-2">
        <ProjectLinks {projectId} />
        <ProjectDetails {projectId} />
      </div>
    {/if}
  </div>
{:else if loaded}
  <div class="page py-6">
    <div class="card">
      <EmptyState
        icon="projects"
        message="Project not found"
        hint="It may have been deleted."
        action={{ label: "Back to Projects", onclick: () => goto("/projects") }}
      />
    </div>
  </div>
{:else}
  <div class="page py-6"><div class="card"><Skeleton /></div></div>
{/if}

<Modal
  open={projectFormOpen}
  title="Edit project"
  onclose={() => (projectFormOpen = false)}
  onsubmit={saveProject}
  ondelete={() => {
    projectFormOpen = false;
    confirmProjectDelete = true;
  }}
  deleteLabel="Delete project"
>
  <ProjectForm bind:values={projectDraft} bind:clients />
</Modal>

<Modal
  open={confirmProjectDelete}
  title="Delete project?"
  submitLabel="Delete project"
  danger
  onclose={() => (confirmProjectDelete = false)}
  onsubmit={removeProject}
>
  <p class="text-sm text-fg">
    <span class="font-medium text-strong">{project?.name}</span> will be deleted with its
    {milestones.length} milestone{milestones.length === 1 ? "" : "s"}, {tasks.length} task{tasks.length === 1 ? "" : "s"}, notes,
    links and details.
  </p>
  <p class="text-xs text-faint">This can't be undone, except by restoring a backup (Settings → Data and backup).</p>
</Modal>

<Modal
  open={milestoneFormOpen}
  title={editingMilestoneId === null ? "New milestone" : "Edit milestone"}
  submitLabel={editingMilestoneId === null ? "Add milestone" : "Save"}
  onclose={() => (milestoneFormOpen = false)}
  onsubmit={saveMilestone}
  ondelete={editingMilestoneId === null
    ? undefined
    : () => {
        milestoneFormOpen = false;
        milestoneToDelete = milestones.find((m) => m.id === editingMilestoneId) ?? null;
      }}
>
  <MilestoneForm bind:values={milestoneDraft} />
</Modal>

<Modal
  open={milestoneToDelete !== null}
  title="Delete milestone?"
  submitLabel="Delete milestone"
  danger
  onclose={() => (milestoneToDelete = null)}
  onsubmit={removeMilestone}
>
  <p class="text-sm text-fg">
    Delete <span class="font-medium text-strong">{milestoneToDelete?.title}</span>? Its tasks are kept but
    unlinked from the milestone.
  </p>
</Modal>

<Modal
  open={taskFormOpen}
  title={editingTaskId === null ? "New task" : "Edit task"}
  submitLabel={editingTaskId === null ? "Add task" : "Save"}
  onclose={() => (taskFormOpen = false)}
  onsubmit={saveTask}
  ondelete={editingTaskId === null ? undefined : deleteEditingTask}
>
  <TaskForm bind:values={taskDraft} {milestones} />
</Modal>
