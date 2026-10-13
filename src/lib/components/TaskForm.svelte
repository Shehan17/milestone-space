<script module lang="ts">
  import { settings } from "$lib/settings.svelte";
  import type { TaskInput as NewTask } from "$lib/types";

  /** A blank task (in a project, or a Misc task with null), with the default priority from Settings. */
  export function emptyTask(project_id: number | null, values: Partial<NewTask> = {}): NewTask {
    return { project_id, milestone_id: null, title: "", priority: settings.default_priority, due_date: null, status: "todo", ...values };
  }

  // The project of the last task added, so the next new task starts there (a display preference).
  // "none" when it was a Misc task.
  const LAST_PROJECT_KEY = "milestonespace.lastTaskProject";
  const NO_PROJECT = "none";

  /**
   * The project a new task starts in: the one used last time if it's in the list (or Misc, if that
   * was last), else the first project, else Misc (null).
   */
  export function defaultProjectId(projects: { id: number }[]): number | null {
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_PROJECT_KEY);
    } catch {
      // No memory: use the first project.
    }
    if (last === NO_PROJECT) return null;
    return projects.find((p) => p.id === Number(last))?.id ?? projects[0]?.id ?? null;
  }

  /** Call after adding a task, for defaultProjectId. */
  export function rememberProject(id: number | null) {
    try {
      localStorage.setItem(LAST_PROJECT_KEY, id === null ? NO_PROJECT : String(id));
    } catch {
      // Not remembered; harmless.
    }
  }
</script>

<script lang="ts">
  import { MISC_LABEL, PRIORITIES, PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, type Milestone, type TaskInput } from "$lib/types";
  import DateInput from "./DateInput.svelte";
  import Field from "./Field.svelte";
  import FilterPills from "./FilterPills.svelte";

  interface Props {
    values: TaskInput;
    /** Pass projects to show a project picker (Misc first). Omit on the project detail page. */
    projects?: { id: number; name: string }[];
    milestones: Milestone[];
  }

  let { values = $bindable(), projects, milestones }: Props = $props();

  const uid = $props.id();

  let projectMilestones = $derived(milestones.filter((m) => m.project_id === values.project_id));

  const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }));
</script>

<Field label="Title" error={values.title.trim() ? null : "Give the task a title"}>
  <input class="input" bind:value={values.title} required data-autofocus placeholder="What needs to be done?" />
</Field>

{#if projects}
  <Field label="Project">
    <!-- Milestones belong to one project, so reset the link when the project changes. -->
    <select class="input" bind:value={values.project_id} onchange={() => (values.milestone_id = null)}>
      <option value={null}>{MISC_LABEL}</option>
      {#each projects as project (project.id)}
        <option value={project.id}>{project.name}</option>
      {/each}
    </select>
  </Field>
{/if}

<!-- A Misc task is just a title and a priority: no milestone, board status or due date (db.ts drops them). -->
{#if values.project_id !== null}
  <Field label="Milestone">
    <select class="input" bind:value={values.milestone_id} disabled={projectMilestones.length === 0}>
      <option value={null}>{projectMilestones.length === 0 ? "This project has no milestones" : "No milestone"}</option>
      {#each projectMilestones as milestone (milestone.id)}
        <option value={milestone.id}>{milestone.title}</option>
      {/each}
    </select>
  </Field>
{/if}

<div>
  <span class="mb-1 block text-xs font-medium text-muted" aria-hidden="true">Priority</span>
  <FilterPills options={priorityOptions} bind:value={values.priority} label="Priority" />
</div>

{#if values.project_id !== null}
  <Field label="Status">
    <select class="input" bind:value={values.status}>
      {#each TASK_STATUSES as status (status)}
        <option value={status}>{TASK_STATUS_LABELS[status]}</option>
      {/each}
    </select>
  </Field>

  <Field label="Due date" for="{uid}-due">
    <DateInput id="{uid}-due" bind:value={values.due_date} />
  </Field>
{/if}
