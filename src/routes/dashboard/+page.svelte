<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import DeadlineLabel from "$lib/components/DeadlineLabel.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon, { type IconName } from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import ProjectDot from "$lib/components/ProjectDot.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import StatCard from "$lib/components/StatCard.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import { getMilestones, getProjects, getTasks } from "$lib/db";
  import { daysLeftInWeek, daysUntil, formatLongDate, todayString } from "$lib/dates";
  import { isArchived } from "$lib/settings.svelte";
  import { PROJECT_TYPES, TYPE_LABELS, type Milestone, type Project, type ProjectType, type Task } from "$lib/types";

  type DueItem = {
    key: string;
    kind: "Task" | "Milestone" | "Project";
    title: string;
    /** The project page, on the tab that shows this item. */
    href: string;
    context: string;
    color: string;
    date: string;
  };

  const KIND_ICONS: Record<DueItem["kind"], IconName> = { Task: "tasks", Milestone: "flag", Project: "projects" };

  let allProjects = $state<Project[]>([]);
  let allTasks = $state<Task[]>([]);
  let allMilestones = $state<Milestone[]>([]);
  let loaded = $state(false);
  let typeFilter = $state<ProjectType | "all">("all");

  onMount(async () => {
    const [p, t, m] = await Promise.all([getProjects(), getTasks(), getMilestones()]);
    allProjects = p;
    allTasks = t;
    allMilestones = m;
    loaded = true;
  });

  const typeTabs = [
    { value: "all" as const, label: "All" },
    ...PROJECT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
  ];

  // Pinned projects are quick links, so they ignore the type filter. Oldest pin first.
  let pinned = $derived(
    allProjects.filter((p) => p.pinned_at && !isArchived(p)).sort((a, b) => a.pinned_at!.localeCompare(b.pinned_at!) || a.id - b.id)
  );

  // Everything else works on the projects of the selected type.
  let projects = $derived(typeFilter === "all" ? allProjects : allProjects.filter((p) => p.type === typeFilter));
  let projectIds = $derived(new Set(projects.map((p) => p.id)));
  let tasks = $derived(allTasks.filter((t) => projectIds.has(t.project_id)));
  let milestones = $derived(allMilestones.filter((m) => projectIds.has(m.project_id)));

  // Work on completed projects no longer counts as due.
  let completedIds = $derived(new Set(projects.filter((p) => p.status === "completed").map((p) => p.id)));

  let dueItems = $derived(
    [
      ...projects
        .filter((p) => p.status !== "completed" && p.deadline)
        .map((p): DueItem => ({
          key: `p${p.id}`,
          kind: "Project",
          title: p.name,
          href: `/projects/${p.id}`,
          context: p.client_name ?? TYPE_LABELS[p.type],
          color: p.color,
          date: p.deadline!,
        })),
      ...milestones
        .filter((m) => !m.is_done && m.due_date && !completedIds.has(m.project_id))
        .map((m): DueItem => ({
          key: `m${m.id}`,
          kind: "Milestone",
          title: m.title,
          href: `/projects/${m.project_id}?tab=milestones`,
          context: m.project_name,
          color: m.project_color,
          date: m.due_date!,
        })),
      ...tasks
        .filter((t) => !t.is_done && t.due_date && !completedIds.has(t.project_id))
        .map((t): DueItem => ({
          key: `t${t.id}`,
          kind: "Task",
          title: t.title,
          href: `/projects/${t.project_id}?tab=tasks`,
          context: t.project_name,
          color: t.project_color,
          date: t.due_date!,
        })),
    ].sort((a, b) => a.date.localeCompare(b.date))
  );

  let overdue = $derived(dueItems.filter((i) => daysUntil(i.date) < 0));
  // Calendar weeks, starting on Monday or Sunday (Settings).
  const weekEnd = daysLeftInWeek();
  const dueBetween = (from: number, to: number) =>
    dueItems.filter((i) => {
      const days = daysUntil(i.date);
      return days >= from && days <= to;
    });
  let thisWeek = $derived(dueBetween(0, weekEnd));
  let nextWeek = $derived(dueBetween(weekEnd + 1, weekEnd + 7));

  let upcomingMilestones = $derived(
    milestones
      .filter((m) => !m.is_done && !completedIds.has(m.project_id) && (!m.due_date || daysUntil(m.due_date) >= 0))
      .slice(0, 8)
  );

  /** Done / total tasks per milestone, for the progress bars. */
  let milestoneProgress = $derived.by(() => {
    const counts = new Map<number, { done: number; total: number }>();
    for (const t of allTasks) {
      if (t.milestone_id === null) continue;
      const c = counts.get(t.milestone_id) ?? { done: 0, total: 0 };
      c.total++;
      if (t.is_done) c.done++;
      counts.set(t.milestone_id, c);
    }
    return counts;
  });

  let activeProjects = $derived(projects.filter((p) => p.status === "active").length);
  let openTasks = $derived(tasks.filter((t) => !t.is_done && !completedIds.has(t.project_id)).length);

  const stat = (n: number) => (loaded ? n : null);
</script>

{#snippet dueRow(item: DueItem)}
  <a href={item.href} class="list-row">
    <span class="text-faint" title={item.kind}><Icon name={KIND_ICONS[item.kind]} size={14} /></span>
    <span class="sr-only">{item.kind}:</span>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm text-fg">{item.title}</p>
      <p class="flex items-center gap-1.5 truncate text-xs text-faint">
        <ProjectDot color={item.color} size={7} />{item.context}
      </p>
    </div>
    <DeadlineLabel date={item.date} />
  </a>
{/snippet}

{#snippet dueSection(title: string, items: DueItem[], empty: string)}
  <section class="card">
    <div class="card-header">
      <h2 class="card-title">{title} <span class="count">{items.length}</span></h2>
    </div>
    {#if !loaded}
      <Skeleton rows={2} />
    {:else}
      <div class="divide-y divide-line">
        {#each items as item (item.key)}
          {@render dueRow(item)}
        {:else}
          <p class="px-4 py-4 text-xs text-faint">{empty}</p>
        {/each}
      </div>
    {/if}
  </section>
{/snippet}

<PageHeader title="Dashboard" subtitle={formatLongDate(todayString())}>
  {#snippet actions()}
    <Tabs options={typeTabs} bind:value={typeFilter} label="Project type" />
  {/snippet}
</PageHeader>

<div class="page space-y-6 py-6">
  <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
    <StatCard label="Overdue" value={stat(overdue.length)} alert />
    <StatCard label="Due this week" value={stat(thisWeek.length)} />
    <StatCard label="Open tasks" value={stat(openTasks)} />
    <StatCard label="Active projects" value={stat(activeProjects)} />
  </div>

  <div class="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
    <div class="space-y-6">
      <section class="card {overdue.length > 0 ? 'border-danger/40' : ''}">
        <div class="card-header">
          <h2 class="card-title {overdue.length > 0 ? 'text-danger' : ''}">
            {#if overdue.length > 0}<Icon name="alert" size={14} />{/if}
            Overdue <span class="count">{overdue.length}</span>
          </h2>
        </div>
        {#if !loaded}
          <Skeleton rows={2} />
        {:else}
          <div class="divide-y divide-line">
            {#each overdue as item (item.key)}
              {@render dueRow(item)}
            {:else}
              <EmptyState compact icon="check-circle" message="Nothing overdue" hint="You're on track." />
            {/each}
          </div>
        {/if}
      </section>

      {@render dueSection("Due this week", thisWeek, "Nothing due this week.")}
      {@render dueSection("Due next week", nextWeek, "Nothing due next week.")}
    </div>

    <div class="space-y-6">
      <section class="card">
        <div class="card-header">
          <h2 class="card-title"><span class="text-accent-text"><Icon name="pin" size={12} /></span>Pinned</h2>
        </div>
        {#if !loaded}
          <Skeleton rows={2} />
        {:else}
          <div class="divide-y divide-line">
            {#each pinned as p (p.id)}
              {@const done = p.task_count - p.open_task_count}
              <a href="/projects/{p.id}" class="block px-4 py-2.5 transition-colors duration-150 hover:bg-hover">
                <div class="flex items-center gap-2">
                  <ProjectDot color={p.color} />
                  <p class="min-w-0 flex-1 truncate text-sm font-medium text-strong">{p.name}</p>
                  <DeadlineLabel date={p.deadline} done={p.status === "completed"} />
                </div>
                <div class="mt-2 flex items-center gap-2 pl-4">
                  <ProgressBar {done} total={p.task_count} color={p.color} />
                  <span class="text-xs text-faint tabular-nums">{done}/{p.task_count}</span>
                </div>
              </a>
            {:else}
              <EmptyState
                compact
                icon="pin"
                message="No pinned projects"
                hint="Pin the projects you open most (on the project page or in the Projects list) to keep them here."
                action={{ label: "Go to Projects", onclick: () => goto("/projects") }}
              />
            {/each}
          </div>
        {/if}
      </section>

      <section class="card">
        <div class="card-header">
          <h2 class="card-title"><span class="text-faint"><Icon name="flag" size={12} /></span>Upcoming milestones</h2>
        </div>
        {#if !loaded}
          <Skeleton rows={2} />
        {:else}
          <div class="divide-y divide-line">
            {#each upcomingMilestones as m (m.id)}
              {@const progress = milestoneProgress.get(m.id)}
              <a href="/projects/{m.project_id}?tab=milestones" class="block px-4 py-2 transition-colors duration-150 hover:bg-hover">
                <div class="flex items-center gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm text-fg">{m.title}</p>
                    <p class="flex items-center gap-1.5 truncate text-xs text-faint">
                      <ProjectDot color={m.project_color} size={7} />{m.project_name}
                    </p>
                  </div>
                  <DeadlineLabel date={m.due_date} />
                </div>
                {#if progress}
                  <div class="mt-1.5 flex items-center gap-2">
                    <ProgressBar done={progress.done} total={progress.total} />
                    <span class="text-xs text-faint tabular-nums">{progress.done}/{progress.total}</span>
                  </div>
                {/if}
              </a>
            {:else}
              <p class="px-4 py-4 text-xs text-faint">No upcoming milestones.</p>
            {/each}
          </div>
        {/if}
      </section>
    </div>
  </div>
</div>
