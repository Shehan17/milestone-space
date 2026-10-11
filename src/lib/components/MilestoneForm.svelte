<script lang="ts">
  import type { MilestoneInput } from "$lib/types";
  import DateInput from "./DateInput.svelte";
  import Field from "./Field.svelte";

  let { values = $bindable() }: { values: MilestoneInput } = $props();

  const uid = $props.id();
</script>

<Field label="Title" error={values.title.trim() ? null : "Give the milestone a title"}>
  <input class="input" bind:value={values.title} required data-autofocus placeholder="e.g. Design approved" />
</Field>
<Field label="Due date" for="{uid}-due">
  <DateInput id="{uid}-due" bind:value={values.due_date} />
</Field>
<Field label="Description">
  <textarea class="input" rows="3" bind:value={values.description}></textarea>
</Field>
