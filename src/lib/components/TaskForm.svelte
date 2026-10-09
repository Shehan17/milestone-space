<script lang="ts">
  import { PRIORITIES, PRIORITY_LABELS, type Milestone, type TaskInput } from "$lib/types";
  import Field from "./Field.svelte";

  interface Props {
    values: TaskInput;
    /** Pass projects to show a project picker (Tasks page). Omit on the project detail page. */
    projects?: { id: number; name: string }[];
    milestones: Milestone[];
  }

  let { values = $bindable(), projects, milestones }: Props = $props();

  let projectMilestones = $derived(milestones.filter((m) => m.project_id === values.project_id));
</script>

<Field label="Title">
  <input class="input" bind:value={values.title} required />
</Field>

{#if projects}
  <Field label="Project">
    <!-- Milestones belong to one project, so reset the link when the project changes. -->
    <select class="input" bind:value={values.project_id} onchange={() => (values.milestone_id = null)}>
      {#each projects as project (project.id)}
        <option value={project.id}>{project.name}</option>
      {/each}
    </select>
  </Field>
{/if}

<Field label="Milestone">
  <select class="input" bind:value={values.milestone_id}>
    <option value={null}>No milestone</option>
    {#each projectMilestones as milestone (milestone.id)}
      <option value={milestone.id}>{milestone.title}</option>
    {/each}
  </select>
</Field>

<div class="grid grid-cols-2 gap-3">
  <Field label="Priority">
    <select class="input" bind:value={values.priority}>
      {#each PRIORITIES as priority (priority)}
        <option value={priority}>{PRIORITY_LABELS[priority]}</option>
      {/each}
    </select>
  </Field>
  <Field label="Due date">
    <input class="input" type="date" bind:value={values.due_date} />
  </Field>
</div>
