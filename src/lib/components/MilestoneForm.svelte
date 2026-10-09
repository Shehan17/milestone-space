<script lang="ts">
  import type { MilestoneInput } from "$lib/types";
  import Field from "./Field.svelte";

  let { values = $bindable() }: { values: MilestoneInput } = $props();
</script>

<Field label="Title">
  <input class="input" bind:value={values.title} required />
</Field>
<Field label="Due date">
  <input class="input" type="date" bind:value={values.due_date} />
</Field>
<Field label="Description">
  <textarea class="input" rows="3" bind:value={values.description}></textarea>
</Field>
