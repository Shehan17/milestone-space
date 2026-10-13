<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import DeadlineLabel from "$lib/components/DeadlineLabel.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Field from "$lib/components/Field.svelte";
  import FilterPills from "$lib/components/FilterPills.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import ProjectAvatar from "$lib/components/ProjectAvatar.svelte";
  import ProjectForm, { emptyProject } from "$lib/components/ProjectForm.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import { addOutlineToProject, addProject, getClients, getProjects, getProjectTemplates, setProjectPinned } from "$lib/db";
  import { onDataChanged } from "$lib/quickadd.svelte";
  import { isArchived, settings } from "$lib/settings.svelte";
  import { useShortcuts } from "$lib/shortcuts.svelte";
  import { describeOutline, parseOutline } from "$lib/templates";
  import { openFolder, openInVsCode } from "$lib/system";
  import { toast } from "$lib/toast.svelte";
  import {
    PROJECT_STATUSES,
    PROJECT_TYPES,
    STATUS_LABELS,
    TYPE_LABELS,
    type Client,
    type Project,
    type ProjectInput,
    type ProjectStatus,
    type ProjectTemplate,
    type ProjectType,
  } from "$lib/types";

  let projects = $state<Project[]>([]);
  let clients = $state<Client[]>([]);
  let templates = $state<ProjectTemplate[]>([]);
  let loaded = $state(false);
  let typeFilter = $state<ProjectType | "all">("all");
  let statusFilter = $state<ProjectStatus | "all">("all");

  // /projects?client=3 (from the Clients page) shows one client's projects.
  let clientFilter = $derived(Number(page.url.searchParams.get("client")) || null);
  let filterClient = $derived(clients.find((c) => c.id === clientFilter) ?? null);

  let formOpen = $state(false);
  let draft = $state<ProjectInput>(emptyProject());

  let ofClient = $derived(clientFilter === null ? projects : projects.filter((p) => p.client_id === clientFilter));
  // With "Move to Archive" (Settings), completed projects only show under the Archive tab.
  let listed = $derived(ofClient.filter((p) => !isArchived(p)));
  let ofType = $derived(typeFilter === "all" ? ofClient : ofClient.filter((p) => p.type === typeFilter));
  let visible = $derived(
    statusFilter === "all" ? ofType.filter((p) => !isArchived(p)) : ofType.filter((p) => p.status === statusFilter)
  );

  let typeTabs = $derived([
    { value: "all" as const, label: "All", count: listed.length },
    ...PROJECT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t], count: listed.filter((p) => p.type === t).length })),
  ]);

  // Status counts follow the selected type.
  let statusTabs = $derived([
    { value: "all" as const, label: "Any status", count: undefined },
    ...PROJECT_STATUSES.map((s) => ({
      value: s,
      label: s === "completed" && settings.completed_projects === "archive" ? "Archive" : STATUS_LABELS[s],
      count: ofType.filter((p) => p.status === s).length,
    })),
  ]);

  let filtered = $derived(typeFilter !== "all" || statusFilter !== "all" || clientFilter !== null);

  function clearFilters() {
    typeFilter = "all";
    statusFilter = "all";
    if (clientFilter !== null) goto("/projects", { replaceState: true, keepFocus: true, noScroll: true });
  }

  async function load() {
    const [p, c, t] = await Promise.all([getProjects(), getClients(), getProjectTemplates()]);
    projects = p;
    clients = c;
    templates = t;
    loaded = true;
  }

  onDataChanged(load);

  onMount(async () => {
    await load();
    // /projects?new=1 (e.g. from the Today page's welcome message) opens the form right away.
    if (page.url.searchParams.has("new")) {
      openNew();
      goto("/projects", { replaceState: true, keepFocus: true, noScroll: true });
    }
  });

  // Templates (made on the Settings page) fill in the form and add their milestones and tasks.
  let template = $state<ProjectTemplate | null>(null);

  function useTemplate(t: ProjectTemplate | null) {
    template = t;
    if (!t) return;
    draft.type = t.type;
    draft.color = t.color;
    if (!draft.description.trim()) draft.description = t.description;
    if (draft.type === "client" && draft.client_id === null) draft.client_id = clients[0]?.id ?? null;
  }

  function openNew() {
    draft = emptyProject();
    template = null;
    // Start with the type and client that are being viewed.
    if (typeFilter !== "all") draft.type = typeFilter;
    if (filterClient) {
      draft.type = "client";
      draft.client_id = filterClient.id;
    } else if (draft.type === "client") {
      draft.client_id = clients[0]?.id ?? null;
    }
    formOpen = true;
  }

  async function togglePinned(project: Project) {
    await setProjectPinned(project.id, !project.pinned_at);
    await load();
    toast.success(project.pinned_at ? "Unpinned" : "Pinned to Today");
  }

  async function openPath(action: (path: string) => Promise<void>, path: string) {
    try {
      await action(path);
    } catch (e) {
      toast.error(`Couldn't open ${path}`, e);
    }
  }

  async function save() {
    if (!draft.name.trim()) return;
    if (draft.type === "client" && draft.client_id === null) return;
    const id = await addProject(draft);
    if (template) await addOutlineToProject(id, parseOutline(template.outline), settings.default_priority);
    formOpen = false;
    toast.success(`Project “${draft.name.trim()}” created`);
    // Straight into the new project, where its milestones and tasks get added.
    await goto(`/projects/${id}`);
  }

  useShortcuts({ n: openNew });
</script>

<PageHeader title="Projects" subtitle="Each project holds its milestones, tasks and notes. Open one to work on it.">
  {#snippet actions()}
    <button type="button" class="btn btn-primary btn-lg" onclick={openNew} title="New project (N)">
      <Icon name="plus" size={18} />New project
    </button>
  {/snippet}
</PageHeader>

<div class="page space-y-4.5 pt-5 pb-12">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="flex flex-wrap items-center gap-3">
      <FilterPills options={typeTabs} bind:value={typeFilter} label="Project type" />
      {#if filterClient}
        <span class="pill pill-on pr-1.5">
          <Icon name="clients" size={14} />{filterClient.name}
          <button
            type="button"
            class="icon-btn p-0.5 text-accent-text-strong"
            aria-label="Show all clients"
            onclick={() => goto("/projects", { replaceState: true, keepFocus: true, noScroll: true })}
          >
            <Icon name="x" size={14} />
          </button>
        </span>
      {/if}
    </div>
    <Tabs options={statusTabs} bind:value={statusFilter} label="Project status" />
  </div>

  {#if !loaded}
    <div class="card"><Skeleton /></div>
  {:else if visible.length > 0}
    <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18.75rem),1fr))] gap-3.5">
      {#each visible as project (project.id)}
        {@const done = project.task_count - project.open_task_count}
        <!-- The link covers the whole card; the buttons sit above it. -->
        <article
          class="group relative flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4.5 transition-colors duration-150 hover:border-line-strong hover:bg-hover"
        >
          <a href="/projects/{project.id}" class="absolute inset-0 rounded-card" aria-label={project.name}></a>
          <div class="flex items-center gap-3">
            <ProjectAvatar name={project.name} color={project.color} />
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-strong">{project.name}</p>
              <p class="truncate text-xs text-faint">
                {TYPE_LABELS[project.type]}{#if project.client_name}&nbsp;· {project.client_name}{/if}
              </p>
            </div>
            <div class="relative flex shrink-0 items-center gap-0.5">
              {#if project.local_path}
                {@const path = project.local_path}
                <span class="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <button type="button" class="icon-btn" aria-label="Open folder" title="Open folder" onclick={() => openPath(openFolder, path)}>
                    <Icon name="folder" size={16} />
                  </button>
                  <button type="button" class="icon-btn" aria-label="Open in VS Code" title="Open in VS Code" onclick={() => openPath(openInVsCode, path)}>
                    <Icon name="code" size={16} />
                  </button>
                </span>
              {/if}
              <button
                type="button"
                class="icon-btn {project.pinned_at ? 'text-accent-text' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}"
                aria-label={project.pinned_at ? "Unpin" : "Pin to Today"}
                aria-pressed={!!project.pinned_at}
                title={project.pinned_at ? "Unpin" : "Pin to Today"}
                onclick={() => togglePinned(project)}
              >
                <Icon name="pin" size={16} />
              </button>
            </div>
          </div>
          <div class="flex items-center gap-2.5" title="{done} of {project.task_count} tasks done">
            <ProgressBar {done} total={project.task_count} color={project.color} />
            <span class="text-xs text-muted tabular-nums">{project.open_task_count} open</span>
          </div>
          <div class="flex items-center justify-between gap-3">
            <StatusBadge status={project.status} />
            <DeadlineLabel date={project.deadline} done={project.status === "completed"} empty="No date" />
          </div>
        </article>
      {/each}
    </div>
  {:else}
    <div class="card">
      {#if projects.length === 0}
        <EmptyState
          icon="projects"
          message="No projects yet"
          hint="A project holds milestones and tasks: client work, a personal idea or a course."
          action={{ label: "New project", icon: "plus", primary: true, onclick: openNew }}
        />
      {:else if filtered}
        <EmptyState message="No projects match these filters" action={{ label: "Clear filters", onclick: clearFilters }} />
      {:else}
        <EmptyState
          message="No open projects"
          hint="Completed projects are under Archive."
          action={{ label: "New project", icon: "plus", onclick: openNew }}
        />
      {/if}
    </div>
  {/if}
</div>

<Modal open={formOpen} title="New project" size="lg" submitLabel="Create project" onclose={() => (formOpen = false)} onsubmit={save}>
  {#if templates.length > 0}
    <Field label="Template" hint={template ? `Adds ${describeOutline(template.outline)}.` : undefined}>
      <select
        class="input"
        value={template?.id ?? ""}
        onchange={(e) => useTemplate(templates.find((t) => t.id === Number(e.currentTarget.value)) ?? null)}
      >
        <option value="">No template</option>
        {#each templates as t (t.id)}
          <option value={t.id}>{t.name} ({describeOutline(t.outline)})</option>
        {/each}
      </select>
    </Field>
  {/if}
  <ProjectForm bind:values={draft} bind:clients />
</Modal>
