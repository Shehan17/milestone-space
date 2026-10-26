<script lang="ts">
  import { untrack } from "svelte";
  import { flip } from "svelte/animate";
  import { SvelteSet } from "svelte/reactivity";
  import { goto, replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import DeadlineLabel from "$lib/components/DeadlineLabel.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import MilestoneForm from "$lib/components/MilestoneForm.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PriorityBadge from "$lib/components/PriorityBadge.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import ProjectDetails from "$lib/components/ProjectDetails.svelte";
  import ProjectAvatar from "$lib/components/ProjectAvatar.svelte";
  import ProjectDot from "$lib/components/ProjectDot.svelte";
  import ProjectForm, { emptyProject } from "$lib/components/ProjectForm.svelte";
  import ProjectLinks from "$lib/components/ProjectLinks.svelte";
  import ProjectNotes from "$lib/components/ProjectNotes.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
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
    getStashedTasks,
    getTasks,
    moveTaskOnBoard,
    setMilestoneDone,
    setProjectPinned,
    setTaskDone,
    setTaskStatus,
    setTasksPlanned,
    stashTask,
    unstashTask,
    updateMilestone,
    updateProject,
    updateTask,
  } from "$lib/db";
  import { formatLongDate, todayString } from "$lib/dates";
  import { ms } from "$lib/motion";
  import { onDataChanged } from "$lib/quickadd.svelte";
  import { settings } from "$lib/settings.svelte";
  import { openFolder, openInVsCode } from "$lib/system";
  import { useShortcuts } from "$lib/shortcuts.svelte";
  import { toast } from "$lib/toast.svelte";
  import {
    STATUS_LABELS,
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
  /** Tasks parked in this project's stash: shown only in the Stash section of the Tasks tab. */
  let stashed = $state<Task[]>([]);
  let clients = $state<Client[]>([]);
  let loaded = $state(false);

  async function load(id: number) {
    const [p, m, t, st] = await Promise.all([getProject(id), getMilestones(id), getTasks(id), getStashedTasks(id)]);
    if (id !== project?.id) {
      // Another project: its own tab and view, and no filter carried over.
      tab = readTab(id);
      taskView = readTaskView(id);
      milestoneFilter = "all";
      stashOpen = false;
      openMilestones.clear();
    }
    project = p;
    milestones = m;
    tasks = t;
    stashed = st;
    loaded = true;
  }

  const reload = () => load(projectId);

  $effect(() => {
    const id = projectId;
    untrack(() => load(id));
  });

  onDataChanged(reload);

  let doneTasks = $derived(tasks.filter((t) => t.is_done).length);
  let openTasks = $derived(tasks.length - doneTasks);

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

  // A link to another tab of the open project (e.g. a task clicked in the Today widget) switches to it.
  $effect(() => {
    const fromUrl = page.url.searchParams.get("tab");
    if (isTab(fromUrl) && untrack(() => tab) !== fromUrl) tab = fromUrl;
  });

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
  /** Up next's done toggles follow the task rows (Settings → Appearance). */
  let checkLeft = $derived(settings.done_toggle_side === "left");

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

  /** Milestones opened on the Milestones tab to show their tasks. */
  const openMilestones = new SvelteSet<number>();

  function toggleMilestoneOpen(id: number) {
    if (openMilestones.has(id)) openMilestones.delete(id);
    else openMilestones.add(id);
  }

  /** A click anywhere on a milestone card opens it, except on its buttons and its task list. */
  function onMilestoneCardClick(e: MouseEvent, id: number) {
    if ((e.target as HTMLElement).closest("button, a, input, [data-milestone-tasks]")) return;
    toggleMilestoneOpen(id);
  }

  function milestoneProgress(milestoneId: number) {
    const linked = tasks.filter((t) => t.milestone_id === milestoneId);
    return { done: linked.filter((t) => t.is_done).length, total: linked.length };
  }

  /** The first milestone not reached yet, in date order (no date last). */
  let nextMilestone = $derived(
    milestones
      .filter((m) => !m.is_done)
      .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.id - b.id)[0] ?? null
  );

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
    toast.success(wasPinned ? "Unpinned" : "Pinned to Today");
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

  // ----- Stash: tasks parked for later, out of every list, Today and reminders until restored -----

  let stashOpen = $state(false);

  async function moveToStash(t: Task) {
    const undo = await stashTask(t.id);
    await reload();
    toast.undo("Moved to stash", async () => {
      await undo();
      await reload();
    });
  }

  async function restoreFromStash(t: Task) {
    await unstashTask(t.id);
    await reload();
    toast.success("Back in the task list");
  }

  function deleteEditingTask() {
    const t = [...tasks, ...stashed].find((x) => x.id === editingTaskId);
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

{#snippet taskCount(done: number, total: number)}
  {done} of {total} {total === 1 ? "task" : "tasks"} done
{/snippet}

{#if project}
  <PageHeader title={project.name} back={{ href: "/projects", label: "Projects" }}>
    {#snippet leading()}
      <ProjectAvatar name={project!.name} color={project!.color} size={44} />
    {/snippet}
    {#snippet meta()}
      <p class="flex min-w-0 flex-wrap items-center gap-x-1.5 text-ui text-muted">
        <span class="truncate">
          {TYPE_LABELS[project!.type]}{#if project!.client_name}&nbsp;· {project!.client_name}{/if}
        </span>
        <span aria-hidden="true">·</span>
        <span class={project!.status === "active" ? "text-accent-text" : ""}>{STATUS_LABELS[project!.status]}</span>
        {#if project!.deadline}
          <span aria-hidden="true">·</span>
          <span class="inline-flex items-center gap-1" title="Project deadline">
            Due <DeadlineLabel date={project!.deadline} done={project!.status === "completed"} />
          </span>
        {/if}
      </p>
    {/snippet}
    {#snippet actions()}
      {#if project!.local_path}
        {@const path = project!.local_path}
        <button type="button" class="btn btn-ghost px-2.5 xl:px-3.5" title="Open {path} in Explorer (O)" onclick={() => openPath(openFolder, path)}>
          <Icon name="folder" size={16} /><span class="hidden xl:inline">Open folder</span>
        </button>
        <button type="button" class="btn btn-ghost px-2.5 xl:px-3.5" title="Open {path} in VS Code (V)" onclick={() => openPath(openInVsCode, path)}>
          <Icon name="code" size={16} /><span class="hidden xl:inline">VS Code</span>
        </button>
      {/if}
      <button
        type="button"
        class="btn btn-ghost px-2.5 xl:px-3.5 {project!.pinned_at ? 'text-accent-text' : ''}"
        title={project!.pinned_at ? "Unpin" : "Pin to Today"}
        aria-pressed={!!project!.pinned_at}
        onclick={togglePinned}
      >
        <Icon name="pin" size={16} /><span class="hidden xl:inline">{project!.pinned_at ? "Pinned" : "Pin"}</span>
      </button>
      <button type="button" class="btn btn-secondary" title="Edit project (E)" onclick={openProjectEdit}>
        <Icon name="edit" size={15} />Edit
      </button>
      <button type="button" class="btn btn-primary btn-lg h-10" title="New task (N)" onclick={() => openNewTask()}>
        <Icon name="plus" size={18} />Add task
      </button>
    {/snippet}
  </PageHeader>

  <div class="page">
    <div class="mt-5.5">
      <Tabs
        variant="underline"
        options={[
          { value: "overview", label: "Overview" },
          { value: "tasks", label: "Tasks", count: openTasks || "" },
          { value: "milestones", label: "Milestones", count: milestones.length || "" },
          { value: "info", label: "Notes & links" },
        ]}
        value={tab}
        onchange={setTab}
        label="Project sections"
      />
    </div>
  </div>

  <div class="page space-y-5 pt-6 pb-12">
    {#if tab === "overview"}
      <div class="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3.5">
        <div class="card flex flex-col gap-3 p-4.5">
          <p class="text-ui text-muted">Progress</p>
          <p class="text-[1.875rem] leading-9 font-semibold text-strong tabular-nums">
            {tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0}%
          </p>
          <div class="flex"><ProgressBar size="md" done={doneTasks} total={tasks.length} color={project.color} /></div>
          <p class="text-xs text-faint">{@render taskCount(doneTasks, tasks.length)}</p>
        </div>

        <div class="card flex flex-col gap-1.5 p-4.5">
          <p class="text-ui text-muted">Next milestone</p>
          {#if nextMilestone}
            {@const progress = milestoneProgress(nextMilestone.id)}
            <button
              type="button"
              class="cursor-pointer truncate text-left text-lg font-semibold text-strong hover:text-accent-text-strong"
              onclick={() => setTab("milestones")}
            >
              {nextMilestone.title}
            </button>
            <DeadlineLabel date={nextMilestone.due_date} empty="No date" />
            <p class="mt-auto pt-2 text-xs text-faint">{@render taskCount(progress.done, progress.total)}</p>
          {:else}
            <p class="text-lg font-semibold text-strong">{milestones.length ? "All reached" : "None yet"}</p>
            <button type="button" class="link mt-auto self-start pt-2 text-xs" onclick={openNewMilestone}>Add a milestone</button>
          {/if}
        </div>

        <div class="card flex flex-col gap-1.5 p-4.5">
          <p class="text-ui text-muted">Project deadline</p>
          {#if project.deadline}
            <p class="text-lg font-semibold text-strong">{formatLongDate(project.deadline)}</p>
            <DeadlineLabel date={project.deadline} done={project.status === "completed"} />
          {:else}
            <p class="text-lg font-semibold text-strong">No deadline</p>
            <button type="button" class="link self-start text-xs" onclick={openProjectEdit}>Set one</button>
          {/if}
          <p class="mt-auto pt-2 text-ui text-muted">{openTasks} {openTasks === 1 ? "task" : "tasks"} still open</p>
        </div>
      </div>

      <section class="card">
        <div class="card-header">
          <h2 class="card-title">Up next in this project</h2>
          <button type="button" class="btn btn-ghost btn-sm" onclick={() => setTab("tasks")}>All tasks</button>
        </div>
        <div class="divide-y divide-line">
          {#each upcoming.slice(0, 5) as u (u.kind + u.item.id)}
            {@const edit = () => (u.kind === "task" ? openEditTask(u.item) : openEditMilestone(u.item))}
            {#snippet doneToggle()}
              <input
                type="checkbox"
                class="check-round {checkLeft ? '' : 'ml-2'}"
                checked={false}
                onchange={() => completeUpcoming(u)}
                aria-label="Mark {u.item.title} as done"
              />
            {/snippet}
            <div class="group relative list-row">
              {#if checkLeft}{@render doneToggle()}{/if}
              <span class="text-faint" title={u.kind === "task" ? "Task" : "Milestone"}>
                <Icon name={u.kind === "task" ? "tasks" : "flag"} size={16} />
              </span>
              <button
                type="button"
                class="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-fg hover:text-accent-text-strong"
                onclick={edit}
              >
                {u.item.title}
              </button>
              <DeadlineLabel date={u.item.due_date} />
              <div class="row-actions {checkLeft ? 'row-actions-end' : ''}">
                <button type="button" class="icon-btn size-8" aria-label="Edit {u.kind}" title="Edit" onclick={edit}>
                  <Icon name="edit" size={15} />
                </button>
                <button
                  type="button"
                  class="icon-btn icon-btn-danger size-8"
                  aria-label="Delete {u.kind}"
                  title="Delete"
                  onclick={() => (u.kind === "task" ? removeTask(u.item) : (milestoneToDelete = u.item))}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
              {#if !checkLeft}{@render doneToggle()}{/if}
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

      <section class="card px-5 py-4">
        <h2 class="card-title mb-1.5">About</h2>
        {#if project.description}
          <p class="text-sm whitespace-pre-line text-fg">{project.description}</p>
        {:else}
          <button type="button" class="link text-sm" onclick={openProjectEdit}>Add a description</button>
        {/if}
        <p class="mt-3 min-w-0 truncate border-t border-line pt-3 text-xs text-faint">
          Folder:
          {#if project.local_path}
            <span class="font-mono text-muted">{project.local_path}</span>
          {:else}
            <button type="button" class="link" onclick={openProjectEdit}>Set a folder</button>
          {/if}
        </p>
      </section>
    {:else if tab === "milestones"}
      <div class="flex items-center justify-between gap-3">
        <p class="text-ui text-muted">
          {milestones.filter((m) => m.is_done).length} of {milestones.length} reached. Click a dot to mark one as reached.
        </p>
        <button type="button" class="btn btn-secondary btn-sm" onclick={openNewMilestone} title="New milestone (M)">
          <Icon name="plus" size={14} />Add milestone
        </button>
      </div>
      {#if milestones.length > 0}
        <ol>
          {#each milestones as m, i (m.id)}
            {@const progress = milestoneProgress(m.id)}
            {@const open = openMilestones.has(m.id)}
            <li class="flex gap-4">
              <div class="flex w-6 shrink-0 flex-col items-center">
                <button
                  type="button"
                  class="mt-5 size-4 shrink-0 cursor-pointer rounded-full border-3 transition-colors duration-150 {m.is_done
                    ? 'border-accent bg-accent'
                    : 'border-faint/60 bg-canvas hover:border-accent'}"
                  aria-pressed={m.is_done}
                  aria-label={m.is_done ? `Mark ${m.title} as not reached` : `Mark ${m.title} as reached`}
                  title={m.is_done ? "Reached" : "Mark as reached"}
                  onclick={() => toggleMilestone(m)}
                ></button>
                {#if i < milestones.length - 1}<span class="w-0.5 flex-1 bg-line"></span>{/if}
              </div>
              <!-- The title button opens it from the keyboard; the rest of the card is a bigger click target. -->
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div
                class="group card mb-3 flex min-w-0 flex-1 cursor-pointer flex-col gap-2.5 px-4.5 py-4"
                onclick={(e) => onMilestoneCardClick(e, m.id)}
              >
                <div class="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    class="flex min-w-0 cursor-pointer items-center gap-1.5 text-left font-semibold {m.is_done
                      ? 'text-faint line-through'
                      : 'text-strong'}"
                    aria-expanded={open}
                    title={open ? "Hide tasks" : "Show tasks"}
                    onclick={() => toggleMilestoneOpen(m.id)}
                  >
                    <span class="truncate">{m.title}</span>
                    <span class="shrink-0 text-faint"><Icon name={open ? "up" : "down"} size={16} /></span>
                  </button>
                  <div class="flex shrink-0 items-center gap-2">
                    <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                      <button type="button" class="icon-btn" aria-label="Add task to {m.title}" title="Add task" onclick={() => openNewTask(m.id)}>
                        <Icon name="plus" size={16} />
                      </button>
                      <button type="button" class="icon-btn" aria-label="Edit milestone" title="Edit" onclick={() => openEditMilestone(m)}>
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        type="button"
                        class="icon-btn icon-btn-danger"
                        aria-label="Delete milestone"
                        title="Delete"
                        onclick={() => (milestoneToDelete = m)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                    <DeadlineLabel date={m.due_date} done={m.is_done} />
                  </div>
                </div>
                {#if m.description}<p class="-mt-1.5 text-xs text-faint">{m.description}</p>{/if}
                <div class="flex items-center gap-2.5">
                  <ProgressBar done={progress.done} total={progress.total} color={project.color} />
                  <span class="text-xs text-faint tabular-nums">{progress.done}/{progress.total} tasks</span>
                </div>
                {#if open}
                  <div class="-mx-4.5 -mb-4 cursor-auto divide-y divide-line border-t border-line" data-milestone-tasks>
                    {#each tasks.filter((t) => t.milestone_id === m.id) as task (task.id)}
                      <div animate:flip={{ duration: ms(200) }}>
                        <TaskRow
                          {task}
                          showMilestone={false}
                          ontoggle={toggleTask}
                          onedit={openEditTask}
                          ondelete={removeTask}
                          onplan={togglePlanned}
                          onstash={moveToStash}
                        />
                      </div>
                    {:else}
                      <p class="px-5 py-3.5 text-xs text-faint">
                        No tasks in this milestone yet.
                        <button type="button" class="link" onclick={() => openNewTask(m.id)}>Add a task</button>
                      </p>
                    {/each}
                  </div>
                {/if}
              </div>
            </li>
          {/each}
        </ol>
      {:else}
        <div class="card">
          <EmptyState
            icon="flag"
            message="No milestones yet"
            hint="Milestones split a project into steps, each with its own due date and tasks."
            action={{ label: "Add milestone", icon: "plus", primary: true, onclick: openNewMilestone }}
          />
        </div>
      {/if}
    {:else if tab === "tasks"}
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-ui text-muted">
          {#if taskView === "board"}
            Drag cards between columns to change their status.
          {:else if visibleTasks.length > 0}
            {visibleTasks.filter((t) => t.is_done).length} of {visibleTasks.length} done.
          {/if}
        </p>
        <div class="flex flex-wrap items-center gap-2.5">
          {#if milestones.length > 0}
            <select class="input input-sm w-52" bind:value={milestoneFilter} aria-label="Filter by milestone">
              <option value="all">All milestones</option>
              {#each milestones as m (m.id)}
                <option value={m.id}>{m.title}</option>
              {/each}
              <option value="none">No milestone</option>
            </select>
          {/if}
          <Tabs
            options={[
              { value: "list", label: "List" },
              { value: "board", label: "Board" },
            ]}
            value={taskView}
            onchange={setTaskView}
            label="Task view"
          />
        </div>
      </div>

      {#if taskView === "board"}
        <TaskBoard
          tasks={visibleTasks}
          onmove={moveTask}
          onedit={openEditTask}
          onadd={(status) => openNewTask(undefined, status)}
          ondelete={removeTask}
          onstash={moveToStash}
        />
      {:else}
        <section class="card divide-y divide-line">
          {#each visibleTasks as task (task.id)}
            <div animate:flip={{ duration: ms(200) }}>
              <TaskRow
                {task}
                ontoggle={toggleTask}
                onedit={openEditTask}
                ondelete={removeTask}
                onplan={togglePlanned}
                onstash={moveToStash}
              />
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
        </section>
      {/if}

      {#if stashed.length > 0}
        <section class="card">
          <button
            type="button"
            class="flex w-full cursor-pointer items-center gap-2 px-5 py-3.5 text-left text-sm font-semibold text-muted transition-colors duration-150 hover:text-strong"
            aria-expanded={stashOpen}
            onclick={() => (stashOpen = !stashOpen)}
          >
            <Icon name={stashOpen ? "up" : "down"} size={16} />Stash <span class="count">{stashed.length}</span>
            <span class="ml-auto hidden truncate text-xs font-normal text-faint lg:inline">
              Parked for later: not in lists, Today or reminders until you bring them back.
            </span>
          </button>
          {#if stashOpen}
            <div class="divide-y divide-line border-t border-line">
              {#each stashed as task (task.id)}
                <div class="group list-row" animate:flip={{ duration: ms(200) }}>
                  <button
                    type="button"
                    class="min-w-0 flex-1 cursor-pointer text-left"
                    title="Edit"
                    onclick={() => openEditTask(task)}
                  >
                    <span class="block truncate text-sm {task.is_done ? 'text-faint line-through' : 'text-fg'}">{task.title}</span>
                    {#if task.milestone_title}
                      <span class="flex items-center gap-1 truncate text-xs text-faint">
                        <Icon name="flag" size={12} /><span class="truncate">{task.milestone_title}</span>
                      </span>
                    {/if}
                  </button>
                  {#if !task.is_done}<PriorityBadge priority={task.priority} />{/if}
                  <div class="w-22 shrink-0 text-right"><DeadlineLabel date={task.due_date} done={task.is_done} /></div>
                  <button type="button" class="btn btn-soft btn-sm" title="Back to the task list" onclick={() => restoreFromStash(task)}>
                    <Icon name="archive-restore" size={14} />Restore
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn-danger size-8"
                    aria-label="Delete {task.title}"
                    title="Delete"
                    onclick={() => removeTask(task)}
                  >
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </section>
      {/if}
    {:else}
      <div class="flex flex-wrap items-start gap-5">
        <div class="min-w-0 flex-[1_1_27.5rem]"><ProjectNotes {projectId} /></div>
        <div class="flex min-w-0 flex-[1_1_17.5rem] flex-col gap-5">
          <ProjectLinks {projectId} />
          <ProjectDetails {projectId} />
        </div>
      </div>
    {/if}
  </div>
{:else if loaded}
  <PageHeader title="Project not found" back={{ href: "/projects", label: "Projects" }} />
  <div class="page pt-5 pb-12">
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
  <div class="page pt-24 pb-12"><div class="card"><Skeleton /></div></div>
{/if}

<Modal
  open={projectFormOpen}
  title="Edit project"
  size="lg"
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
  {#snippet aside()}
    {#if project}<span class="flex min-w-0 items-center gap-1.5"><ProjectDot color={project.color} /><span class="truncate">{project.name}</span></span>{/if}
  {/snippet}
  <TaskForm bind:values={taskDraft} {milestones} />
</Modal>
