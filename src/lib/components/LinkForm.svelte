<script lang="ts">
  import { linkError } from "$lib/links";
  import { LINK_TYPES, LINK_TYPE_LABELS, type ProjectLinkInput } from "$lib/types";
  import Field from "./Field.svelte";

  let { values = $bindable() }: { values: ProjectLinkInput } = $props();
</script>

<Field label="Title" error={values.title.trim() ? null : "Give the link a title"}>
  <input class="input" bind:value={values.title} placeholder="e.g. Repository" required data-autofocus />
</Field>
<Field label="URL" error={linkError(values.url)} hint="A web address, or a folder like G:\My Drive\designs">
  <input class="input" bind:value={values.url} placeholder="https://… or a folder path" required />
</Field>
<Field label="Type">
  <select class="input" bind:value={values.type}>
    {#each LINK_TYPES as type (type)}
      <option value={type}>{LINK_TYPE_LABELS[type]}</option>
    {/each}
  </select>
</Field>
