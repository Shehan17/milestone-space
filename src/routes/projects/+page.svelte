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
  import Field from "$lib/components/Field.svelte";
  import { addOutlineToProject, addProject, getClients, getProjects, getProjectTemplates, setProjectPinned } from "$lib/db";
  import { isArchived, settings } from "$lib/settings.svelte";
  import { useShortcuts } from "$lib/shortcuts.svelte";
  import { describeOutline, parseOutline } from "$lib/templates";
  import { openFolder, openInVsCode } from "$lib/system";
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
  let typeFilter = $state<ProjectType | "all">("all");
  let statusFilter = $state<ProjectStatus | "all">("all");

  let formOpen = $state(false);
  let draft = $state<ProjectInput>(emptyProject());

  // With "Move to Archive" (Settings), completed projects only show under the Archive tab.
  let listed = $derived(projects.filter((p) => !isArchived(p)));
  let ofType = $derived(typeFilter === "all" ? projects : projects.filter((p) => p.type === typeFilter));
  let visible = $derived(
    statusFilter === "all" ? ofType.filter((p) => !isArchived(p)) : ofType.filter((p) => p.status === statusFilter)
  );

  let typeTabs = $derived([
    { value: "all" as const, label: "All", count: listed.length },
    ...PROJECT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t], count: listed.filter((p) => p.type === t).length })),
  ]);

  // Status counts follow the selected type.
  let statusTabs = $derived([
    { value: "all" as const, label: "Any status" },
    ...PROJECT_STATUSES.map((s) => ({
      value: s,
      label: s === "completed" && settings.completed_projects === "archive" ? "Archive" : STATUS_LABELS[s],
      count: ofType.filter((p) => p.status === s).length,
    })),
  ]);

  async function load() {
    const [p, c, t] = await Promise.all([getProjects(), getClients(), getProjectTemplates()]);
    projects = p;
    clients = c;
    templates = t;
  }

  onMount(load);

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
    const id = await addProject(draft);
    if (template) await addOutlineToProject(id, parseOutline(template.outline), settings.default_priority);
    formOpen = false;
    await load();
  }

  useShortcuts({ n: openNew });
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
        <!-- Folder buttons for projects with a local folder; the same width either way so columns line up. -->
        <div class="relative flex w-14 shrink-0 justify-end gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          {#if project.local_path}
            {@const path = project.local_path}
            <button type="button" class="icon-btn" aria-label="Open folder" title="Open folder" onclick={() => openFolder(path)}>
              <Icon name="folder" size={14} />
            </button>
            <button type="button" class="icon-btn" aria-label="Open in VS Code" title="Open in VS Code" onclick={() => openInVsCode(path)}>
              <Icon name="code" size={14} />
            </button>
          {/if}
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
  {#if templates.length > 0}
    <Field label="Template">
      <select class="input" value={template?.id ?? ""} onchange={(e) => useTemplate(templates.find((t) => t.id === Number(e.currentTarget.value)) ?? null)}>
        <option value="">No template</option>
        {#each templates as t (t.id)}
          <option value={t.id}>{t.name} ({describeOutline(t.outline)})</option>
        {/each}
      </select>
    </Field>
  {/if}
  <ProjectForm bind:values={draft} {clients} />
</Modal>
