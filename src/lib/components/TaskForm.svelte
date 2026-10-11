<script module lang="ts">
  import { settings } from "$lib/settings.svelte";
  import type { TaskInput as NewTask } from "$lib/types";

  /** A blank task in a project, with the default priority from Settings. */
  export function emptyTask(project_id: number, values: Partial<NewTask> = {}): NewTask {
    return { project_id, milestone_id: null, title: "", priority: settings.default_priority, due_date: null, status: "todo", ...values };
  }

  // The project of the last task added, so the next new task starts there (a display preference).
  const LAST_PROJECT_KEY = "milestonespace.lastTaskProject";

  /** The project a new task starts in: the one used last time if it's in the list, else the first. */
  export function defaultProjectId(projects: { id: number }[]): number {
    let last = NaN;
    try {
      last = Number(localStorage.getItem(LAST_PROJECT_KEY));
    } catch {
      // No memory: use the first project.
    }
    return projects.find((p) => p.id === last)?.id ?? projects[0]?.id ?? 0;
  }

  /** Call after adding a task, for defaultProjectId. */
  export function rememberProject(id: number) {
    try {
      localStorage.setItem(LAST_PROJECT_KEY, String(id));
    } catch {
      // Not remembered; harmless.
    }
  }
</script>

<script lang="ts">
  import { PRIORITIES, PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_LABELS, type Milestone, type TaskInput } from "$lib/types";
  import DateInput from "./DateInput.svelte";
  import Field from "./Field.svelte";

  interface Props {
    values: TaskInput;
    /** Pass projects to show a project picker (Tasks page). Omit on the project detail page. */
    projects?: { id: number; name: string }[];
    milestones: Milestone[];
  }

  let { values = $bindable(), projects, milestones }: Props = $props();

  const uid = $props.id();

  let projectMilestones = $derived(milestones.filter((m) => m.project_id === values.project_id));
</script>

<Field label="Title" error={values.title.trim() ? null : "Give the task a title"}>
  <input class="input" bind:value={values.title} required data-autofocus placeholder="What needs to be done?" />
</Field>

{#if projects}
  <Field label="Project" error={values.project_id ? null : "Create a project first"}>
    <!-- Milestones belong to one project, so reset the link when the project changes. -->
    <select class="input" bind:value={values.project_id} onchange={() => (values.milestone_id = null)}>
      {#each projects as project (project.id)}
        <option value={project.id}>{project.name}</option>
      {/each}
    </select>
  </Field>
{/if}

<Field label="Milestone">
  <select class="input" bind:value={values.milestone_id} disabled={projectMilestones.length === 0}>
    <option value={null}>{projectMilestones.length === 0 ? "This project has no milestones" : "No milestone"}</option>
    {#each projectMilestones as milestone (milestone.id)}
      <option value={milestone.id}>{milestone.title}</option>
    {/each}
  </select>
</Field>

<div class="grid grid-cols-2 gap-3">
  <Field label="Status">
    <select class="input" bind:value={values.status}>
      {#each TASK_STATUSES as status (status)}
        <option value={status}>{TASK_STATUS_LABELS[status]}</option>
      {/each}
    </select>
  </Field>
  <Field label="Priority">
    <select class="input" bind:value={values.priority}>
      {#each PRIORITIES as priority (priority)}
        <option value={priority}>{PRIORITY_LABELS[priority]}</option>
      {/each}
    </select>
  </Field>
</div>

<Field label="Due date" for="{uid}-due">
  <DateInput id="{uid}-due" bind:value={values.due_date} />
</Field>
