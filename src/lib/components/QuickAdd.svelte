<!--
  The New dialog (sidebar button, or N on pages without their own N): one line for a task on today's plan, a task for a project,
  an idea for the Inbox, a Misc task, or a new project. In the text field ← / → change what to add and ↑ / ↓ the task's project.
  The quick capture window (/quick) is the same idea from outside the app.
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { addInboxItem, addProject, addTask, getClients, getProjects } from "$lib/db";
  import { todayString } from "$lib/dates";
  import { notifyInboxChanged } from "$lib/inbox.svelte";
  import {
    KIND_LABELS,
    kindStep,
    notifyDataChanged,
    picksProject,
    projectChoices,
    projectStep,
    quickAdd,
    rememberCapture,
    stepIn,
    type QuickAddKind,
  } from "$lib/quickadd.svelte";
  import { isArchived } from "$lib/settings.svelte";
  import { toast } from "$lib/toast.svelte";
  import { MISC_LABEL, type Project } from "$lib/types";
  import FilterPills from "./FilterPills.svelte";
  import Modal from "./Modal.svelte";
  import { emptyProject } from "./ProjectForm.svelte";
  import { defaultProjectId, emptyTask, rememberProject } from "./TaskForm.svelte";

  /** In ← / → order. */
  const KINDS: { value: QuickAddKind; label: string; title: string; placeholder: string }[] = [
    { value: "today", label: KIND_LABELS.today, title: "task for today", placeholder: "What do you need to do today?" },
    { value: "task", label: KIND_LABELS.task, title: "project task", placeholder: "What needs doing?" },
    { value: "idea", label: KIND_LABELS.idea, title: "Inbox idea", placeholder: "Jot it down, sort it later" },
    { value: "misc", label: KIND_LABELS.misc, title: "Misc task", placeholder: "A small everyday job" },
    { value: "project", label: KIND_LABELS.project, title: "project", placeholder: "Name the project" },
  ];

  let text = $state("");
  let projects = $state<Project[]>([]);
  /** The task's project; null for a Misc task. */
  let projectId = $state<number | null>(null);

  let kind = $derived(KINDS.find((k) => k.value === quickAdd.kind) ?? KINDS[0]);
  let projectIds = $derived(projectChoices(quickAdd.kind, projects));

  // Fresh each time it opens: the projects may have changed since.
  $effect(() => {
    if (!quickAdd.open) return;
    text = "";
    getProjects().then((all) => {
      projects = all.filter((p) => p.status !== "completed" && !isArchived(p));
      projectId = defaultProjectId(projects);
      fitProject();
    });
  });

  /** A project task needs a project, not Misc. */
  function fitProject() {
    if (quickAdd.kind === "task" && projectId === null) projectId = projects[0]?.id ?? null;
  }

  // In the text field: ← / → what to add, ↑ / ↓ the task's project.
  function oninputkeydown(event: KeyboardEvent) {
    const by = kindStep(event);
    if (by) {
      quickAdd.kind = stepIn(KINDS.map((k) => k.value), quickAdd.kind, by);
      fitProject();
    } else if (picksProject(quickAdd.kind) && projectIds.length > 0) {
      const step = projectStep(event);
      if (step) projectId = stepIn(projectIds, projectId, step);
    }
  }

  function close() {
    quickAdd.open = false;
  }

  async function submit() {
    const value = text.trim();
    if (!value) return;

    if (quickAdd.kind === "idea") {
      await addInboxItem(value);
      rememberCapture();
      close();
      await notifyInboxChanged();
      toast.success("Saved to Inbox", { action: { label: "Open", run: () => goto("/inbox") } });
    } else if (quickAdd.kind === "today") {
      await addTask(emptyTask(projectId, { title: value }), todayString());
      rememberProject(projectId);
      close();
      notifyDataChanged();
      const name = projects.find((p) => p.id === projectId)?.name;
      toast.success(`Task added to ${name ?? MISC_LABEL} and Today`, { action: { label: "Open", run: () => goto("/") } });
    } else if (quickAdd.kind === "task") {
      const project = projects.find((p) => p.id === projectId);
      if (!project) return; // No active project: the dialog says so.
      await addTask(emptyTask(project.id, { title: value }));
      rememberProject(project.id);
      close();
      notifyDataChanged();
      toast.success(`Task added to ${project.name}`, { action: { label: "Open", run: () => goto(`/projects/${project.id}?tab=tasks`) } });
    } else if (quickAdd.kind === "misc") {
      await addTask(emptyTask(null, { title: value }));
      close();
      notifyDataChanged();
      toast.success(`Task added to ${MISC_LABEL}`, { action: { label: "Open", run: () => goto("/misc") } });
    } else {
      // A client project needs a client: the first one, or a personal project when there is none.
      const draft = { ...emptyProject(), name: value };
      if (draft.type === "client") {
        const [client] = await getClients();
        if (client) draft.client_id = client.id;
        else draft.type = "personal";
      }
      const id = await addProject(draft);
      close();
      notifyDataChanged();
      toast.success(`Project “${value}” created`);
      await goto(`/projects/${id}`);
    }
  }
</script>

<Modal open={quickAdd.open} title="New {kind.title}" hideHeader size="lg" submitLabel="Add" onclose={close} onsubmit={submit}>
  <div class="flex items-start gap-3">
    <FilterPills options={KINDS} bind:value={quickAdd.kind} onchange={fitProject} label="What to add" />
    <span class="ml-auto hidden shrink-0 items-center gap-1 pt-1 text-xs text-faint sm:inline-flex" title="Change what to add from the text field"><kbd class="kbd">←</kbd><kbd class="kbd">→</kbd></span>
  </div>
  <input
    class="h-14 w-full bg-transparent px-1 text-lg text-strong outline-none placeholder:text-faint"
    bind:value={text}
    placeholder={kind.placeholder}
    aria-label={kind.placeholder}
    autocomplete="off"
    data-autofocus
    onkeydown={oninputkeydown}
  />
  {#if picksProject(quickAdd.kind)}
    {#if projectIds.length > 0}
      <label class="!mt-1 flex flex-wrap items-center gap-2 px-1 pb-2 text-xs text-faint">
        Project
        <select class="input input-sm w-auto max-w-64 min-w-0 truncate" bind:value={projectId}>
          {#if quickAdd.kind === "today"}<option value={null}>{MISC_LABEL}</option>{/if}
          {#each projects as project (project.id)}
            <option value={project.id}>{project.name}</option>
          {/each}
        </select>
        <span class="inline-flex items-center gap-1" title="Change the project from the text field"><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd> to change</span>
      </label>
    {:else}
      <p class="!mt-1 px-1 pb-2 text-xs text-faint">No active projects yet. Pick {MISC_LABEL}, or add a New project first.</p>
    {/if}
  {/if}

  {#snippet footer()}
    {#if quickAdd.kind === "idea"}
      Goes to your Inbox.
    {:else if quickAdd.kind === "project"}
      Opens the new project.
    {:else if quickAdd.kind === "misc"}
      Adds to Misc, not planned for a day.
    {:else if quickAdd.kind === "task"}
      Adds to the project, not planned for a day.
    {:else if projectId === null}
      Adds to Misc and today's plan.
    {:else}
      Adds to the project and today's plan.
    {/if}
  {/snippet}
</Modal>
