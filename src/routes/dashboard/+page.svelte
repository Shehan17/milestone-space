<script lang="ts">
  import { onMount } from "svelte";
  import DeadlineLabel from "$lib/components/DeadlineLabel.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ProjectDot from "$lib/components/ProjectDot.svelte";
  import StatCard from "$lib/components/StatCard.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import { getMilestones, getProjects, getTasks } from "$lib/db";
  import { daysLeftInWeek, daysUntil } from "$lib/dates";
  import { isArchived } from "$lib/settings.svelte";
  import { PROJECT_TYPES, TYPE_LABELS, type Milestone, type Project, type ProjectType, type Task } from "$lib/types";

  type DueItem = {
    key: string;
    kind: "Task" | "Milestone" | "Project";
    title: string;
    projectId: number;
    context: string;
    color: string;
    date: string;
  };

  let allProjects = $state<Project[]>([]);
  let allTasks = $state<Task[]>([]);
  let allMilestones = $state<Milestone[]>([]);
  let typeFilter = $state<ProjectType | "all">("all");

  onMount(async () => {
    const [p, t, m] = await Promise.all([getProjects(), getTasks(), getMilestones()]);
    allProjects = p;
    allTasks = t;
    allMilestones = m;
  });

  const typeTabs = [
    { value: "all" as const, label: "All" },
    ...PROJECT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
  ];

  // Pinned projects are quick links, so they ignore the type filter. Oldest pin first.
  let pinned = $derived(
    allProjects.filter((p) => p.pinned_at && !isArchived(p)).sort((a, b) => a.pinned_at!.localeCompare(b.pinned_at!) || a.id - b.id)
  );

  // Everything below works on the projects of the selected type.
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
          projectId: p.id,
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
          projectId: m.project_id,
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
          projectId: t.project_id,
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

  let activeProjects = $derived(projects.filter((p) => p.status === "active").length);
  let openTasks = $derived(tasks.filter((t) => !t.is_done && !completedIds.has(t.project_id)).length);
</script>

{#snippet dueRow(item: DueItem)}
  <a href="/projects/{item.projectId}" class="flex items-center gap-3 px-4 py-2 hover:bg-zinc-800/30">
    <span class="w-16 shrink-0 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{item.kind}</span>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm text-zinc-200">{item.title}</p>
      <p class="flex items-center gap-1.5 truncate text-xs text-zinc-500">
        <ProjectDot color={item.color} size={7} />{item.context}
      </p>
    </div>
    <DeadlineLabel date={item.date} />
  </a>
{/snippet}

<PageHeader title="Dashboard">
  {#snippet actions()}
    <Tabs options={typeTabs} bind:value={typeFilter} />
  {/snippet}
</PageHeader>

<div class="space-y-6 px-8 py-6">
  <section>
    <h2 class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
      <span class="text-violet-400"><Icon name="pin" size={12} /></span>Pinned
    </h2>
    {#if pinned.length > 0}
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {#each pinned as p (p.id)}
          {@const done = p.task_count - p.open_task_count}
          <a href="/projects/{p.id}" class="card block min-w-0 px-4 py-3 transition-colors hover:border-zinc-700 hover:bg-zinc-800/40">
            <div class="flex items-center gap-2">
              <ProjectDot color={p.color} />
              <p class="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{p.name}</p>
              <DeadlineLabel date={p.deadline} done={p.status === "completed"} />
            </div>
            <p class="mt-0.5 truncate pl-4 text-xs text-zinc-500">{p.client_name ?? TYPE_LABELS[p.type]}</p>
            <div class="mt-3 flex items-center gap-2">
              <div class="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div
                  class="h-full"
                  style="width: {p.task_count ? (done / p.task_count) * 100 : 0}%; background-color: {p.color}"
                ></div>
              </div>
              <span class="text-xs text-zinc-500 tabular-nums">{done}/{p.task_count}</span>
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <p class="card px-4 py-3 text-xs text-zinc-500">
        No pinned projects. Use the pin button on a project to keep it here for quick access.
      </p>
    {/if}
  </section>

  <div class="grid grid-cols-3 gap-3">
    <StatCard label="Active projects" value={activeProjects} />
    <StatCard label="Open tasks" value={openTasks} />
    <StatCard label="Overdue" value={overdue.length} alert />
  </div>

  <div class="grid gap-6 lg:grid-cols-2">
    <div class="space-y-6">
      <section class="card">
        <h2 class="border-b border-zinc-800 px-4 py-2.5 text-xs font-semibold text-red-400">
          Overdue <span class="ml-1 text-zinc-500">{overdue.length}</span>
        </h2>
        {#each overdue as item (item.key)}
          {@render dueRow(item)}
        {:else}
          <EmptyState message="Nothing overdue." />
        {/each}
      </section>

      <section class="card">
        <h2 class="border-b border-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-300">
          Due this week <span class="ml-1 text-zinc-500">{thisWeek.length}</span>
        </h2>
        {#each thisWeek as item (item.key)}
          {@render dueRow(item)}
        {:else}
          <EmptyState message="Nothing due this week." />
        {/each}
      </section>

      <section class="card">
        <h2 class="border-b border-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-300">
          Due next week <span class="ml-1 text-zinc-500">{nextWeek.length}</span>
        </h2>
        {#each nextWeek as item (item.key)}
          {@render dueRow(item)}
        {:else}
          <EmptyState message="Nothing due next week." />
        {/each}
      </section>
    </div>

    <section class="card self-start">
      <h2 class="border-b border-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-300">Upcoming milestones</h2>
      {#each upcomingMilestones as m (m.id)}
        <a href="/projects/{m.project_id}" class="flex items-center gap-3 px-4 py-2 hover:bg-zinc-800/30">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-zinc-200">{m.title}</p>
            <p class="flex items-center gap-1.5 truncate text-xs text-zinc-500">
              <ProjectDot color={m.project_color} size={7} />{m.project_name}
            </p>
          </div>
          <DeadlineLabel date={m.due_date} />
        </a>
      {:else}
        <EmptyState message="No upcoming milestones." />
      {/each}
    </section>
  </div>
</div>
