<!--
  The quick capture box: its own small window, opened from anywhere with the global shortcut
  (src-tauri/src/lib.rs). Enter saves and clears the field, so you can add more; "Added to …" shows in the
  bottom bar for a moment. Esc or clicking elsewhere hides it and keeps what was typed for next time. Like the New dialog,
  ← / → pick what to add (Inbox, Today, a project task, Misc) and ↑ / ↓ the task's project.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import FilterPills from "$lib/components/FilterPills.svelte";
  import Icon, { type IconName } from "$lib/components/Icon.svelte";
  import ProjectDot from "$lib/components/ProjectDot.svelte";
  import { defaultProjectId, emptyTask, rememberProject } from "$lib/components/TaskForm.svelte";
  import { todayString } from "$lib/dates";
  import { addInboxItem, addTask, getProjects } from "$lib/db";
  import { notifyInboxChanged } from "$lib/inbox.svelte";
  import {
    KIND_LABELS,
    kindStep,
    notifyDataChangedEverywhere,
    picksProject,
    projectChoices,
    projectStep,
    rememberCapture,
    stepIn,
    type QuickAddKind,
  } from "$lib/quickadd.svelte";
  import { isArchived } from "$lib/settings.svelte";
  import { MISC_LABEL, type Project } from "$lib/types";

  const appWindow = getCurrentWindow();

  /** How long "Added to …" shows in the bottom bar. */
  const CONFIRM_MS = 2500;

  type CaptureKind = Exclude<QuickAddKind, "project">;
  /** In ← / → order. A new project is made in the main window. */
  const KINDS: { value: CaptureKind; label: string; icon: IconName }[] = [
    { value: "idea", label: KIND_LABELS.idea, icon: "inbox" },
    { value: "today", label: KIND_LABELS.today, icon: "sun" },
    { value: "task", label: KIND_LABELS.task, icon: "tasks" },
    { value: "misc", label: KIND_LABELS.misc, icon: "shapes" },
  ];

  let text = $state("");
  let error = $state("");
  /** While a save is running: Enter again does nothing. */
  let saving = false;
  let projects = $state<Project[]>([]);
  // What Enter adds, and the task's project (null: Misc). Kept while the window is hidden.
  let kind = $state<CaptureKind>("idea");
  let projectId = $state<number | null>(null);
  let loaded = false;

  let projectIds = $derived(projectChoices(kind, projects));
  let project = $derived(projects.find((p) => p.id === projectId));
  let isTask = $derived(kind !== "idea");
  let icon = $derived<IconName>(KINDS.find((k) => k.value === kind)?.icon ?? "inbox");
  /** Where the last save went, shown in the bottom bar for CONFIRM_MS ("" when not shown). */
  let addedTo = $state("");
  let input = $state<HTMLInputElement>();
  let confirmTimer: ReturnType<typeof setTimeout> | undefined;
  let focusTimers: ReturnType<typeof setTimeout>[] = [];

  /** When focusInput() tries again: WebView2 sometimes gets the keyboard a moment after the window is shown. */
  const FOCUS_RETRY_MS = [50, 150, 300];

  /** Focuses the text field now and a few times shortly after (unless a pill or chip has been focused since). */
  function focusInput() {
    focusTimers.forEach(clearTimeout);
    input?.focus();
    focusTimers = FOCUS_RETRY_MS.map((ms) =>
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || active === document.body || active === input) input?.focus();
      }, ms),
    );
  }

  // Fresh each time it's shown: projects may have been added or completed since.
  async function loadProjects() {
    const all = await getProjects();
    projects = all.filter((p) => p.status !== "completed" && !isArchived(p));
    if (!loaded) projectId = defaultProjectId(projects);
    else if (projectId !== null && !projects.some((p) => p.id === projectId)) projectId = null;
    loaded = true;
    fitProject();
  }

  /** A project task needs a project, not Misc. */
  function fitProject() {
    if (kind === "task" && projectId === null) projectId = projects[0]?.id ?? null;
  }

  onMount(() => {
    focusInput();
    loadProjects();
    // Shown again: focus the box. Lost focus (clicked elsewhere): get out of the way.
    const unlisten = appWindow.onFocusChanged(async ({ payload: focused }) => {
      if (focused) {
        clearTimeout(confirmTimer);
        addedTo = "";
        focusInput();
        await loadProjects();
      } else {
        appWindow.hide();
      }
    });
    return () => {
      clearTimeout(confirmTimer);
      focusTimers.forEach(clearTimeout);
      unlisten.then((stop) => stop());
    };
  });

  async function save(event: SubmitEvent) {
    event.preventDefault();
    const title = text.trim();
    if (!title || saving) return;
    saving = true;
    let to: string;
    try {
      if (kind === "today") {
        await addTask(emptyTask(projectId, { title }), todayString());
        rememberProject(projectId);
        to = project ? `${project.name} and Today` : "Today";
      } else if (kind === "task") {
        if (!project) {
          error = `No active projects yet. Pick ${MISC_LABEL}, or create a project in the app.`;
          return;
        }
        await addTask(emptyTask(project.id, { title }));
        rememberProject(project.id);
        to = project.name;
      } else if (kind === "misc") {
        await addTask(emptyTask(null, { title }));
        to = MISC_LABEL;
      } else {
        await addInboxItem(text);
        rememberCapture();
        to = "Inbox";
      }
      text = "";
      error = "";
      addedTo = to;
      clearTimeout(confirmTimer);
      confirmTimer = setTimeout(() => (addedTo = ""), CONFIRM_MS);
      input?.focus();
      await (isTask ? notifyDataChangedEverywhere() : notifyInboxChanged());
    } catch (e) {
      error = String(e);
    } finally {
      saving = false;
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      appWindow.hide();
    }
  }

  function setKind(next: CaptureKind) {
    kind = next;
    error = "";
    fitProject();
  }

  // In the text field: ← / → what to add, ↑ / ↓ the task's project.
  function oninputkeydown(event: KeyboardEvent) {
    const by = kindStep(event);
    if (by) {
      setKind(stepIn(KINDS.map((k) => k.value), kind, by));
    } else if (picksProject(kind) && projectIds.length > 0) {
      const step = projectStep(event);
      if (step) projectId = stepIn(projectIds, projectId, step);
    }
  }
</script>

<!-- focus: the webview itself got the keyboard, which can come a moment after the window shows. -->
<svelte:window {onkeydown} onfocus={focusInput} />

<form class="flex h-screen flex-col overflow-hidden border border-line-strong bg-raised" onsubmit={save}>
  <div class="flex flex-1 flex-col justify-center gap-2.5 px-5">
    <FilterPills
      options={KINDS}
      bind:value={kind}
      onchange={(next) => {
        setKind(next);
        input?.focus();
      }}
      label="What to add"
    />
    <div class="flex items-center gap-3">
      <span class="text-accent-text"><Icon name={icon} size={18} /></span>
      <input
        bind:this={input}
        bind:value={text}
        class="min-w-0 flex-1 bg-transparent text-lg text-strong outline-none placeholder:text-faint"
        placeholder={isTask ? "Add a task…" : "Capture an idea or task…"}
        aria-label={kind === "idea" ? "Idea or task for the Inbox" : kind === "misc" ? "Misc task" : kind === "today" ? "Task for today" : "Project task"}
        autocomplete="off"
        spellcheck="false"
        onkeydown={oninputkeydown}
      />
      {#if picksProject(kind)}
        {#if projectIds.length > 0}
          <button
            type="button"
            class="chip chip-on flex max-w-48 shrink-0 items-center gap-1.5"
            title="Project (↑ / ↓ to change)"
            aria-live="polite"
            onclick={() => {
              projectId = stepIn(projectIds, projectId, 1);
              input?.focus();
            }}
          >
            {#if project}
              <ProjectDot color={project.color} />
              <span class="truncate">{project.name}</span>
            {:else}
              <Icon name="shapes" size={13} />{MISC_LABEL}
            {/if}
          </button>
        {:else}
          <span class="shrink-0 text-xs text-faint">No active projects</span>
        {/if}
      {/if}
    </div>
  </div>
  {#if error}
    <p class="truncate border-t border-line bg-chrome px-5 py-2 text-xs text-danger" title={error}>{error}</p>
  {:else if addedTo}
    <p class="flex items-center gap-1.5 overflow-hidden border-t border-line bg-chrome px-5 py-2 text-xs whitespace-nowrap text-success" role="status">
      <Icon name="check-circle" size={14} /><span class="truncate">Added to {addedTo}. Type the next one, or Esc to close.</span>
    </p>
  {:else}
    <p class="flex items-center gap-3 overflow-hidden border-t border-line bg-chrome px-5 py-2 text-xs whitespace-nowrap text-faint">
      <span class="inline-flex items-center gap-1.5"><kbd class="kbd">Enter</kbd> {isTask ? "add task" : "save to Inbox"}</span>
      <span>·</span>
      <span class="inline-flex items-center gap-1.5"><span class="inline-flex gap-0.5"><kbd class="kbd">←</kbd><kbd class="kbd">→</kbd></span> what</span>
      {#if picksProject(kind)}
        <span>·</span>
        <span class="inline-flex items-center gap-1.5"><span class="inline-flex gap-0.5"><kbd class="kbd">↑</kbd><kbd class="kbd">↓</kbd></span> project</span>
      {/if}
      <span>·</span>
      <span class="inline-flex items-center gap-1.5"><kbd class="kbd">Esc</kbd> close</span>
    </p>
  {/if}
</form>
