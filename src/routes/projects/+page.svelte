<script lang="ts">
  import { onMount } from "svelte";
  import DeadlineLabel from "$lib/components/DeadlineLabel.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ProjectDot from "$lib/components/ProjectDot.svelte";
  import ProjectForm, { emptyProject } from "$lib/components/ProjectForm.svelte";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import { addProject, getClients, getProjects, setProjectPinned } from "$lib/db";
  import {
    PROJECT_STATUSES,
    PROJECT_TYPES,
    STATUS_LABELS,
    TYPE_LABELS,
    type Client,
    type Project,
    type ProjectInput,
    type ProjectStatus,
    type ProjectType,
  } from "$lib/types";

  let projects = $state<Project[]>([]);
  let clients = $state<Client[]>([]);
  let typeFilter = $state<ProjectType | "all">("all");
  let statusFilter = $state<ProjectStatus | "all">("all");

  let formOpen = $state(false);
  let draft = $state<ProjectInput>(emptyProject());

  let ofType = $derived(typeFilter === "all" ? projects : projects.filter((p) => p.type === typeFilter));
  let visible = $derived(statusFilter === "all" ? ofType : ofType.filter((p) => p.status === statusFilter));

  let typeTabs = $derived([
    { value: "all" as const, label: "All", count: projects.length },
    ...PROJECT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t], count: projects.filter((p) => p.type === t).length })),
  ]);

  // Status counts follow the selected type.
  let statusTabs = $derived([
    { value: "all" as const, label: "Any status" },
    ...PROJECT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s], count: ofType.filter((p) => p.status === s).length })),
  ]);

  async function load() {
    const [p, c] = await Promise.all([getProjects(), getClients()]);
    projects = p;
    clients = c;
  }

  onMount(load);

  function openNew() {
    draft = emptyProject();
    // Start with the type that's being viewed.
    if (typeFilter !== "all") draft.type = typeFilter;
    if (draft.type === "client") draft.client_id = clients[0]?.id ?? null;
    formOpen = true;
  }

  async function togglePinned(project: Project) {
    await setProjectPinned(project.id, !project.pinned_at);
    await load();
  }

  async function save() {
    if (!draft.name.trim()) return;
    if (draft.type === "client" && draft.client_id === null) return;
    await addProject(draft);
    formOpen = false;
    await load();
  }
</script>

<PageHeader title="Projects" subtitle="{projects.length} total">
  {#snippet actions()}
    <button type="button" class="btn btn-primary" onclick={openNew}><Icon name="plus" size={14} />New project</button>
  {/snippet}
</PageHeader>

<div class="space-y-4 px-8 py-6">
  <div class="flex flex-wrap items-center gap-3">
    <Tabs options={typeTabs} bind:value={typeFilter} />
    <Tabs options={statusTabs} bind:value={statusFilter} />
  </div>

  <div class="card divide-y divide-zinc-800/70">
    {#each visible as project (project.id)}
      <!-- The link covers the whole row; the pin button sits above it. -->
      <div class="group relative flex items-center gap-4 px-4 py-2.5 hover:bg-zinc-800/30">
        <a href="/projects/{project.id}" class="absolute inset-0" aria-label={project.name}></a>
        <ProjectDot color={project.color} />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-zinc-100">{project.name}</p>
          <p class="truncate text-xs text-zinc-500">{project.client_name ?? TYPE_LABELS[project.type]}</p>
        </div>
        <span class="w-24 shrink-0 text-xs text-zinc-500 tabular-nums">
          {project.open_task_count} open task{project.open_task_count === 1 ? "" : "s"}
        </span>
        <div class="w-24 shrink-0"><StatusBadge status={project.status} /></div>
        <div class="w-28 shrink-0 text-right">
          <DeadlineLabel date={project.deadline} done={project.status === "completed"} />
        </div>
        <button
          type="button"
          class="icon-btn relative shrink-0 {project.pinned_at
            ? 'text-violet-400'
            : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}"
          aria-label={project.pinned_at ? "Unpin from dashboard" : "Pin to dashboard"}
          title={project.pinned_at ? "Unpin from dashboard" : "Pin to dashboard"}
          onclick={() => togglePinned(project)}
        >
          <Icon name="pin" size={14} />
        </button>
      </div>
    {:else}
      <EmptyState message={projects.length === 0 ? "No projects yet. Create your first one." : "No projects match these filters."} />
    {/each}
  </div>
</div>

<Modal open={formOpen} title="New project" onclose={() => (formOpen = false)} onsubmit={save}>
  <ProjectForm bind:values={draft} {clients} />
</Modal>
