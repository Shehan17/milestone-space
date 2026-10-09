<script lang="ts">
  import { LINK_TYPES, LINK_TYPE_LABELS, type ProjectLinkInput } from "$lib/types";
  import Field from "./Field.svelte";

  let { values = $bindable() }: { values: ProjectLinkInput } = $props();
</script>

<Field label="Title">
  <input class="input" bind:value={values.title} placeholder="e.g. Repository" required />
</Field>
<Field label="URL">
  <input class="input" bind:value={values.url} placeholder="https://… or a folder like G:\My Drive\…" required />
</Field>
<Field label="Type">
  <select class="input" bind:value={values.type}>
    {#each LINK_TYPES as type (type)}
      <option value={type}>{LINK_TYPE_LABELS[type]}</option>
    {/each}
  </select>
</Field>
