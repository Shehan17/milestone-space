<!--
  Project templates on the Settings page: add, edit, delete, or start one from an existing
  project. New projects can start from a template (Projects page → New project).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import ColorPicker from "$lib/components/ColorPicker.svelte";
  import Field from "$lib/components/Field.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import ProjectDot from "$lib/components/ProjectDot.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import {
    addProjectTemplate,
    deleteProjectTemplate,
    getMilestones,
    getProjects,
    getProjectTemplates,
    getTasks,
    updateProjectTemplate,
  } from "$lib/db";
  import { settings } from "$lib/settings.svelte";
  import { describeOutline, outlineFromProject } from "$lib/templates";
  import { toast } from "$lib/toast.svelte";
  import {
    PROJECT_COLORS,
    PROJECT_TYPES,
    TYPE_LABELS,
    type Project,
    type ProjectTemplate,
    type ProjectTemplateInput,
  } from "$lib/types";

  let templates = $state<ProjectTemplate[]>([]);
  let projects = $state<Project[]>([]);
  let loaded = $state(false);

  async function load() {
    const [t, p] = await Promise.all([getProjectTemplates(), getProjects()]);
    templates = t;
    projects = p;
    loaded = true;
  }

  onMount(load);

  let formOpen = $state(false);
  let editingId = $state<number | null>(null);
  let draft = $state<ProjectTemplateInput>(blank());

  function blank(): ProjectTemplateInput {
    return { name: "", type: settings.default_project_type, color: PROJECT_COLORS[0], description: "", outline: "" };
  }

  function openNew(values: ProjectTemplateInput = blank()) {
    editingId = null;
    draft = values;
    formOpen = true;
  }

  function openEdit(t: ProjectTemplate) {
    editingId = t.id;
    draft = { name: t.name, type: t.type, color: t.color, description: t.description, outline: t.outline };
    formOpen = true;
  }

  /** "From project…": a new template with the project's milestones and tasks. */
  async function fromProject(event: Event) {
    const select = event.currentTarget as HTMLSelectElement;
    const project = projects.find((p) => p.id === Number(select.value));
    select.value = "";
    if (!project) return;
    const [milestones, tasks] = await Promise.all([getMilestones(project.id), getTasks(project.id)]);
    openNew({
      name: project.name,
      type: project.type,
      color: project.color,
      description: project.description,
      outline: outlineFromProject(milestones, tasks),
    });
  }

  async function save() {
    if (!draft.name.trim()) return;
    if (editingId === null) await addProjectTemplate(draft);
    else await updateProjectTemplate(editingId, draft);
    toast.success(editingId === null ? "Template added" : "Template saved");
    formOpen = false;
    await load();
  }

  async function remove(t: ProjectTemplate) {
    const undo = await deleteProjectTemplate(t.id);
    await load();
    toast.undo(`Template “${t.name}” deleted`, async () => {
      await undo();
      await load();
    });
  }

  const typeOptions = PROJECT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }));
</script>

<div class="space-y-2">
  {#if templates.length > 0}
    <div class="divide-y divide-line rounded-control border border-line">
      {#each templates as t (t.id)}
        <div class="group flex items-center gap-3 px-3 py-2 transition-colors duration-150 hover:bg-hover">
          <ProjectDot color={t.color} />
          <button type="button" class="min-w-0 flex-1 cursor-pointer text-left" onclick={() => openEdit(t)}>
            <p class="truncate text-sm text-fg">{t.name}</p>
            <p class="truncate text-xs text-faint">{TYPE_LABELS[t.type]} · {describeOutline(t.outline)}</p>
          </button>
          <div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" class="icon-btn" aria-label="Edit template" title="Edit" onclick={() => openEdit(t)}>
              <Icon name="edit" size={14} />
            </button>
            <button type="button" class="icon-btn icon-btn-danger" aria-label="Delete template" title="Delete" onclick={() => remove(t)}>
              <Icon name="trash" size={14} />
            </button>
          </div>
        </div>
      {/each}
    </div>
  {:else if loaded}
    <p class="text-xs text-faint">
      No templates yet. A template sets up a new project with its milestones and tasks, e.g. for a kind of client
      work you do often.
    </p>
  {/if}
  <div class="flex flex-wrap items-center gap-2">
    <button type="button" class="btn btn-secondary btn-sm" onclick={() => openNew()}>
      <Icon name="plus" size={12} />New template
    </button>
    {#if projects.length > 0}
      <select class="input input-sm w-48" onchange={fromProject} aria-label="New template from a project">
        <option value="">From a project…</option>
        {#each projects as p (p.id)}
          <option value={p.id}>{p.name}</option>
        {/each}
      </select>
    {/if}
  </div>
</div>

<Modal
  open={formOpen}
  title={editingId === null ? "New template" : "Edit template"}
  size="lg"
  onclose={() => (formOpen = false)}
  onsubmit={save}
  ondelete={editingId === null
    ? undefined
    : () => {
        const t = templates.find((x) => x.id === editingId);
        formOpen = false;
        if (t) remove(t);
      }}
>
  <Field label="Name" error={draft.name.trim() ? null : "Give the template a name"}>
    <input class="input" bind:value={draft.name} required data-autofocus placeholder="e.g. Website for a client" />
  </Field>
  <div>
    <span class="mb-1 block text-xs font-medium text-muted">Project type</span>
    <Tabs options={typeOptions} bind:value={draft.type} label="Project type" />
  </div>
  <ColorPicker bind:value={draft.color} />
  <Field label="Description">
    <textarea class="input" rows="2" bind:value={draft.description}></textarea>
  </Field>
  <Field
    label="Milestones and tasks"
    hint="One per line: # Milestone, then its tasks as - Task. Tasks above the first milestone don't belong to one. Tasks get the default priority."
  >
    <textarea
      class="input font-mono text-xs leading-relaxed"
      rows="9"
      bind:value={draft.outline}
      placeholder={"# Design\n- Wireframes\n- Mockups\n# Build\n- Frontend\n- Backend"}
      spellcheck="false"
    ></textarea>
  </Field>
</Modal>
