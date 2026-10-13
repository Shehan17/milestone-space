<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import { SvelteSet } from "svelte/reactivity";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import DeadlineLabel from "$lib/components/DeadlineLabel.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import PriorityBadge from "$lib/components/PriorityBadge.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import ProgressRing from "$lib/components/ProgressRing.svelte";
  import ProjectAvatar from "$lib/components/ProjectAvatar.svelte";
  import ProjectDot from "$lib/components/ProjectDot.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import StatCard from "$lib/components/StatCard.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import TaskForm, { defaultProjectId, emptyTask, rememberProject } from "$lib/components/TaskForm.svelte";
  import TaskRow from "$lib/components/TaskRow.svelte";
  import { addTask, deleteTask, getMilestones, getProjects, getTasks, setTaskDone, setTasksPlanned, updateTask } from "$lib/db";
  import { calendarParts, daysLeftInWeek, daysUntil, formatDate, formatLongDate, todayString } from "$lib/dates";
  import { dueItems } from "$lib/due";
  import { inbox } from "$lib/inbox.svelte";
  import { ms } from "$lib/motion";
  import { hasCaptured, onDataChanged } from "$lib/quickadd.svelte";
  import { isArchived, quickCaptureKeys, setWidgetShown, settings } from "$lib/settings.svelte";
  import { toast } from "$lib/toast.svelte";
  import {
    byTodayOrder,
    byUrgency,
    inShownProject,
    MISC_COLOR,
    MISC_LABEL,
    type Milestone,
    type Project,
    type Task,
    type TaskInput,
  } from "$lib/types";
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
  onDataChanged(load);

  // The app may stay open overnight: start the new day's list when the window is focused again.
  function onfocus() {
    if (todayString() !== today) load();
  }

  // Tasks of completed projects aren't offered or counted; Misc tasks always are.
  let openProjectIds = $derived(new Set(projects.filter((p) => p.status !== "completed").map((p) => p.id)));
  const isOpenWork = (t: Task) => inShownProject(t, openProjectIds);

  // Today's list: open tasks first, finished ones stay at the bottom until tomorrow.
  let todayTasks = $derived(tasks.filter((t) => t.planned_for === today).sort(byTodayOrder));
  let doneCount = $derived(todayTasks.filter((t) => t.is_done).length);

  // Due today or overdue, but not on any day's list: offered so nothing late goes unseen.
  let dueNotPlanned = $derived(
    tasks
      .filter((t) => !t.is_done && t.planned_for === null && t.due_date !== null && t.due_date <= today)
      .filter(isOpenWork)
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

  // ----- Header -----

  // Checked once a minute: the greeting follows the time of day, and past midnight the new day's list starts.
  let now = $state(new Date());

  onMount(() => {
    const timer = setInterval(() => {
      now = new Date();
      onfocus();
    }, 60_000);
    return () => clearInterval(timer);
  });

  let greeting = $derived.by(() => {
    const hour = now.getHours();
    const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const name = settings.display_name.trim();
    return name ? `${part}, ${name}` : part;
  });

  let summary = $derived.by(() => {
    if (!loaded) return "";
    const left = todayTasks.length - doneCount;
    const plan =
      todayTasks.length === 0
        ? "Nothing in today's plan yet"
        : left === 0
          ? "Everything in today's plan is done"
          : `${left} ${left === 1 ? "task" : "tasks"} left in today's plan`;
    const due = dueNotPlanned.length;
    return due > 0 ? `${plan} and ${due} that ${due === 1 ? "needs" : "need"} attention.` : `${plan}.`;
  });

  // ----- Getting started: five first steps, until they're done or hidden -----

  const HIDE_KEY = "milestonespace.gettingStartedHidden";

  function readHidden() {
    try {
      return localStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  }

  let onboardingHidden = $state(readHidden());

  function hideOnboarding() {
    onboardingHidden = true;
    try {
      localStorage.setItem(HIDE_KEY, "1");
    } catch {
      // Hidden until the page is left.
    }
  }

  let steps = $derived([
    {
      title: "Create a project",
      hint: "Group your work by client, idea or course.",
      done: projects.length > 0,
      go: () => goto("/projects?new=1"),
    },
    {
      title: "Add a few tasks",
      hint: "Break the project into small steps.",
      done: tasks.length > 0,
      go: () => goto(projects[0] ? `/projects/${projects[0].id}?tab=tasks` : "/projects?new=1"),
    },
    {
      title: "Plan your day",
      hint: "Pick what you will do today.",
      done: tasks.some((t) => t.planned_for !== null),
      go: openPicker,
    },
    {
      title: "Capture an idea",
      hint: `Press ${quickCaptureKeys()} anywhere.`,
      done: inbox.count > 0 || hasCaptured(),
      go: () => goto("/inbox"),
    },
    {
      title: "Pin a favorite",
      hint: "Keep a project one click away.",
      done: projects.some((p) => p.pinned_at),
      go: () => goto("/projects"),
    },
  ]);
  let stepsDone = $derived(steps.filter((s) => s.done).length);
  let showOnboarding = $derived(loaded && !onboardingHidden && stepsDone < steps.length);

  // ----- Side column: stats, pinned projects, coming up -----

  let shownProjects = $derived(projects.filter((p) => !isArchived(p)));
  let due = $derived(dueItems(shownProjects, milestones, tasks));
  let overdueCount = $derived(due.filter((i) => daysUntil(i.date) < 0).length);
  let thisWeekCount = $derived(
    due.filter((i) => {
      const days = daysUntil(i.date);
      return days >= 0 && days <= daysLeftInWeek();
    }).length
  );
  let openTaskCount = $derived(tasks.filter((t) => !t.is_done && isOpenWork(t)).length);
  // Today's items are already in the plan or Needs attention, so this starts tomorrow.
  let comingUp = $derived(due.filter((i) => daysUntil(i.date) > 0).slice(0, 5));

  // Oldest pin first.
  let pinned = $derived(
    shownProjects.filter((p) => p.pinned_at).sort((a, b) => a.pinned_at!.localeCompare(b.pinned_at!) || a.id - b.id)
  );

  const stat = (n: number) => (loaded ? n : null);

  // ----- Actions -----

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

  // ----- Add to Today: pick existing tasks from every project, or create a new one -----
  type AddMode = "pick" | "new";
  const ADD_MODES: { value: AddMode; label: string; icon: "sun" | "plus" }[] = [
    { value: "pick", label: "Existing tasks", icon: "sun" },
    { value: "new", label: "New task", icon: "plus" },
  ];
  let addOpen = $state(false);
  let addMode = $state<AddMode>("pick");
  let search = $state("");
  const selected = new SvelteSet<number>();

  // Open tasks not already on today's list, from projects that aren't completed (or Misc).
  let candidates = $derived(tasks.filter((t) => !t.is_done && t.planned_for !== today && isOpenWork(t)));
  let matching = $derived.by(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((t) => t.title.toLowerCase().includes(q) || (t.project_name ?? MISC_LABEL).toLowerCase().includes(q));
  });

  // Overdue or due within 3 days goes first; everything else is grouped by project, Misc first.
  const isDueSoon = (t: Task) => t.due_date !== null && daysUntil(t.due_date) <= 3;
  let dueSoon = $derived(matching.filter(isDueSoon).sort((a, b) => a.due_date!.localeCompare(b.due_date!)));
  let byProject = $derived(
    [
      { key: "none", name: MISC_LABEL, color: MISC_COLOR, id: null as number | null },
      ...projects.map((p) => ({ key: String(p.id), name: p.name, color: p.color, id: p.id as number | null })),
    ]
      .map((g) => ({ ...g, tasks: matching.filter((t) => t.project_id === g.id && !isDueSoon(t)).sort(byUrgency) }))
      .filter((g) => g.tasks.length > 0)
  );

  function openAdd(mode: AddMode) {
    search = "";
    selected.clear();
    draft = emptyTask(defaultProjectId(openProjects));
    addMode = mode;
    addOpen = true;
  }

  function openPicker() {
    openAdd("pick");
  }

  function openNew() {
    openAdd("new");
  }

  /** The Add task button: existing tasks first, unless there are none left to pick. */
  function openAddTask() {
    openAdd(candidates.length > 0 ? "pick" : "new");
  }

  function togglePick(id: number) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
  }

  async function saveAdd() {
    if (addMode === "pick") {
      const ids = [...selected];
      addOpen = false;
      if (ids.length > 0) await addAllToToday(ids);
      return;
    }
    // New tasks go straight onto today's list.
    if (!draft.title.trim()) return;
    await addTask(draft, today);
    rememberProject(draft.project_id);
    toast.success("Task added to Today");
    addOpen = false;
    await load();
  }

  let draft = $state<TaskInput>(emptyTask(null));
  let openProjects = $derived(projects.filter((p) => p.status !== "completed"));

  // ----- Edit a task on today's list -----
  let editOpen = $state(false);
  let editingId = $state<number | null>(null);

  function openEdit(t: Task) {
    editingId = t.id;
    draft = { project_id: t.project_id, milestone_id: t.milestone_id, title: t.title, priority: t.priority, due_date: t.due_date, status: t.status };
    editOpen = true;
  }

  async function saveEdit() {
    if (!draft.title.trim() || editingId === null) return;
    await updateTask(editingId, draft);
    toast.success("Task saved");
    editOpen = false;
    await load();
  }

  function deleteEditing() {
    const t = tasks.find((x) => x.id === editingId);
    editOpen = false;
    if (t) remove(t);
  }

  // /?plan=1 (the widget's "Plan my day") opens the picker. An effect, as the page may already be open.
  $effect(() => {
    if (loaded && page.url.searchParams.has("plan")) {
      openPicker();
      goto("/", { replaceState: true, keepFocus: true, noScroll: true });
    }
  });

  useShortcuts({ n: openNew, p: openPicker });
</script>

<svelte:window {onfocus} />

{#snippet pickRow(task: Task, showProject: boolean)}
  <label class="flex cursor-pointer items-center gap-3 px-6 py-2 transition-colors duration-150 hover:bg-hover">
    <input type="checkbox" class="checkbox" checked={selected.has(task.id)} onchange={() => togglePick(task.id)} />
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm text-fg">{task.title}</p>
      {#if showProject && task.project_id !== null}
        <p class="flex items-center gap-1.5 truncate text-xs text-faint">
          <ProjectDot color={task.project_color!} />{task.project_name}
        </p>
      {/if}
    </div>
    <PriorityBadge priority={task.priority} />
    <span class="w-22 shrink-0 text-right"><DeadlineLabel date={task.due_date} /></span>
  </label>
{/snippet}

<!-- A task offered for today (due, or left over from an earlier day): one click puts it on the plan. -->
{#snippet offerRow(task: Task, note: string, onremove?: () => void)}
  <div class="group list-row min-h-14">
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm text-fg">{task.title}</p>
      <p class="flex items-center gap-1.5 truncate text-xs text-faint">
        <a
          href={task.project_id === null ? "/misc" : `/projects/${task.project_id}?tab=tasks`}
          class="inline-flex min-w-0 items-center gap-1.5 hover:text-fg"
        >
          <ProjectDot color={task.project_color ?? MISC_COLOR} /><span class="truncate">{task.project_name ?? MISC_LABEL}</span>
        </a>
        {#if note}<span class="shrink-0">· {note}</span>{/if}
      </p>
    </div>
    <PriorityBadge priority={task.priority} />
    <div class="shrink-0 text-right"><DeadlineLabel date={task.due_date} /></div>
    <button type="button" class="btn btn-soft btn-sm" onclick={() => plan([task.id], today)} title="Add to today's plan">
      <Icon name="plus" size={14} />Plan
    </button>
    {#if onremove}
      <button
        type="button"
        class="icon-btn"
        aria-label="Take {task.title} off the plan"
        title="Take off the plan (the task stays in your tasks)"
        onclick={onremove}
      >
        <Icon name="x" size={16} />
      </button>
    {/if}
  </div>
{/snippet}

<PageHeader small title={greeting} subtitle={summary || " "}>
  {#snippet actions()}
    <button type="button" class="btn btn-primary btn-lg" onclick={openPicker} title="Pick today's tasks (P)">
      <Icon name="sun" size={18} />Plan my day
    </button>
  {/snippet}
</PageHeader>

<div class="page space-y-5 pt-5 pb-12">
  {#if showOnboarding}
    <section class="space-y-4 rounded-card border border-accent/25 bg-accent/[0.04] px-6 py-5" aria-label="Getting started">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold text-strong">Getting started</h2>
          <p class="text-ui text-muted">{stepsDone} of {steps.length} done. Each step takes under a minute.</p>
        </div>
        <button type="button" class="btn btn-sm border border-accent/25 text-muted hover:border-accent/50 hover:text-strong" onclick={hideOnboarding}>
          Hide
        </button>
      </div>
      <ol class="grid grid-cols-[repeat(auto-fit,minmax(11.25rem,1fr))] gap-2.5">
        {#each steps as step, i (step.title)}
          <li>
            <button
              type="button"
              class="flex h-full w-full cursor-pointer flex-col items-start gap-2 rounded-item border p-3.5 text-left transition-colors duration-150 hover:border-accent/50 {step.done
                ? 'border-accent/15'
                : 'border-accent/25 bg-accent/[0.05]'}"
              onclick={step.go}
            >
              <span
                class="grid size-6 place-items-center rounded-full border-[1.5px] text-2xs font-bold {step.done
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-accent/45 text-accent-text-strong'}"
              >
                {#if step.done}<Icon name="check" size={13} />{:else}{i + 1}{/if}
              </span>
              <span class="text-ui font-semibold {step.done ? 'text-faint line-through' : 'text-strong'}">{step.title}</span>
              <span class="text-xs text-faint">{step.hint}</span>
              {#if step.done}<span class="sr-only">(done)</span>{/if}
            </button>
          </li>
        {/each}
      </ol>
    </section>
  {/if}

  <div class="flex flex-wrap items-start gap-5">
    <div class="flex min-w-0 flex-[1_1_32.5rem] flex-col gap-5">
      <section class="card">
        <div class="flex items-center gap-4 px-5 py-4.5">
          <ProgressRing done={doneCount} total={todayTasks.length} />
          <div class="min-w-0 flex-1">
            <h2 class="text-[1.0625rem] font-semibold text-strong">Today's plan</h2>
            <p class="text-ui text-muted">
              {loaded && todayTasks.length > 0 ? `${doneCount} of ${todayTasks.length} done` : "No tasks yet"}
            </p>
          </div>
          <button
            type="button"
            class="icon-btn {settings.show_widget ? 'text-accent-text hover:text-accent-text' : ''}"
            aria-label={settings.show_widget ? "Hide the Today widget" : "Show on desktop"}
            title={settings.show_widget ? "Hide the Today widget" : "Show today's plan on the desktop"}
            aria-pressed={settings.show_widget}
            onclick={() => setWidgetShown(!settings.show_widget)}
          >
            <Icon name="monitor" size={17} />
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            onclick={openAddTask}
            title="Add an existing or new task to today (P / N)"
          >
            <Icon name="plus" size={15} />Add task
          </button>
        </div>
        {#if !loaded}
          <div class="border-t border-line"><Skeleton /></div>
        {:else if todayTasks.length > 0}
          <div class="divide-y divide-line border-t border-line">
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
          <div class="border-t border-line">
            <EmptyState
              icon="projects"
              message="Welcome to MilestoneSpace"
              hint="Create your first project, or add a Misc task and start today's plan."
              action={{ label: "New project", icon: "plus", primary: true, onclick: () => goto("/projects?new=1") }}
            />
          </div>
        {:else}
          <div class="border-t border-line">
            <EmptyState
              message="Nothing planned yet"
              hint={dueNotPlanned.length > 0
                ? "Some tasks need attention. Add them below, or pick a few from your projects."
                : "Pick a few tasks from your projects to focus on today."}
              action={{ label: "Plan my day", icon: "sun", onclick: openPicker }}
            />
          </div>
        {/if}
      </section>

      {#if dueNotPlanned.length > 0}
        {@const anyOverdue = dueNotPlanned.some((t) => t.due_date! < today)}
        <section class="overflow-clip rounded-card border border-danger/30 bg-[color-mix(in_oklab,var(--danger)_4%,var(--surface))]">
          <div class="flex flex-wrap items-center gap-2.5 px-5 py-4">
            <span class="text-danger"><Icon name="alert" size={18} /></span>
            <div class="min-w-0 flex-1">
              <h2 class="text-base font-semibold text-strong">
                {anyOverdue ? "Needs attention" : "Due today"} <span class="count">{dueNotPlanned.length}</span>
              </h2>
              <p class="text-xs text-muted">
                {anyOverdue ? "Overdue or due today" : "Due today"}, and not in your plan yet.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-sm border border-danger/30 text-strong hover:bg-danger/10"
              onclick={() => addAllToToday(dueNotPlanned.map((t) => t.id))}
            >
              Add all to plan
            </button>
          </div>
          <div class="divide-y divide-danger/15 border-t border-danger/15">
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
              Add all to plan
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

    <div class="flex min-w-0 flex-[1_1_18.75rem] flex-col gap-5">
      <section class="grid grid-cols-3 gap-2.5" aria-label="At a glance">
        <StatCard label="Overdue" value={stat(overdueCount)} alert />
        <StatCard label="This week" value={stat(thisWeekCount)} />
        <StatCard label="Open tasks" value={stat(openTaskCount)} />
      </section>

      <section class="card">
        <div class="flex items-center justify-between gap-3 px-4.5 pt-4 pb-2.5">
          <h2 class="card-title">Pinned projects</h2>
          <a href="/projects" class="link text-xs">All projects</a>
        </div>
        {#if !loaded}
          <div class="border-t border-line"><Skeleton rows={2} /></div>
        {:else}
          {#each pinned as p (p.id)}
            {@const done = p.task_count - p.open_task_count}
            <a href="/projects/{p.id}" class="block space-y-2.5 border-t border-line px-4.5 py-3 transition-colors duration-150 hover:bg-hover">
              <span class="flex items-center gap-2.5">
                <ProjectAvatar name={p.name} color={p.color} size={28} />
                <span class="min-w-0 flex-1 truncate font-medium text-strong">{p.name}</span>
                <DeadlineLabel date={p.deadline} done={p.status === "completed"} />
              </span>
              <span class="flex items-center gap-2.5">
                <ProgressBar {done} total={p.task_count} color={p.color} />
                <span class="text-xs text-faint tabular-nums">{done}/{p.task_count}</span>
              </span>
            </a>
          {:else}
            <p class="border-t border-line px-4.5 py-4 text-xs text-faint">
              Pin the projects you open most (the pin on a project) to keep them here.
            </p>
          {/each}
        {/if}
      </section>

      <section class="card">
        <h2 class="card-title px-4.5 pt-4 pb-2.5">Coming up</h2>
        {#if !loaded}
          <div class="border-t border-line"><Skeleton rows={2} /></div>
        {:else}
          {#each comingUp as item (item.key)}
            {@const parts = calendarParts(item.date)}
            <a href={item.href} class="flex items-center gap-3 border-t border-line px-4.5 py-2.5 transition-colors duration-150 hover:bg-hover">
              <span class="w-10 shrink-0 text-center" title={formatLongDate(item.date)}>
                <span class="eyebrow block text-[0.6875rem]">{parts.month}</span>
                <span class="block text-lg leading-5.5 font-semibold text-strong">{parts.day}</span>
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-ui text-fg">{item.title}</span>
                <span class="flex items-center gap-1.5 truncate text-xs text-faint">
                  <ProjectDot color={item.color} />{item.kind} · {item.context}
                </span>
              </span>
            </a>
          {:else}
            <p class="border-t border-line px-4.5 py-4 text-xs text-faint">Nothing else is due soon.</p>
          {/each}
        {/if}
      </section>
    </div>
  </div>
</div>

<Modal
  open={addOpen}
  title="Add to Today"
  description={addMode === "pick" ? "Open tasks from your active projects and Misc." : "A new task, straight onto today's plan."}
  size="lg"
  submitLabel={addMode === "new" ? "Add task" : selected.size > 0 ? `Add ${selected.size} to Today` : "Done"}
  onclose={() => (addOpen = false)}
  onsubmit={saveAdd}
>
  <Tabs options={ADD_MODES} bind:value={addMode} label="What to add" />
  {#if addMode === "new"}
    <TaskForm bind:values={draft} projects={openProjects} {milestones} />
  {:else}
    <input class="input" placeholder="Search tasks or projects" bind:value={search} aria-label="Search tasks" data-autofocus />
    <div class="-mx-6 max-h-[50vh] overflow-y-auto border-y border-line pb-2">
      {#if dueSoon.length > 0}
        <p class="eyebrow px-6 pt-3 pb-1 text-warning">Due soon</p>
        {#each dueSoon as task (task.id)}
          {@render pickRow(task, true)}
        {/each}
      {/if}
      {#each byProject as group (group.key)}
        <p class="eyebrow flex items-center gap-1.5 px-6 pt-3 pb-1">
          <ProjectDot color={group.color} />{group.name}
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
  {/if}
</Modal>

<Modal open={editOpen} title="Edit task" onclose={() => (editOpen = false)} onsubmit={saveEdit} ondelete={deleteEditing}>
  {#snippet aside()}
    {@const p = projects.find((x) => x.id === draft.project_id)}
    {#if p}<span class="flex min-w-0 items-center gap-1.5"><ProjectDot color={p.color} /><span class="truncate">{p.name}</span></span>{/if}
  {/snippet}
  <TaskForm bind:values={draft} {projects} {milestones} />
</Modal>
