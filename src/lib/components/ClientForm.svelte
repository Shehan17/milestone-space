<script lang="ts">
  import type { ClientInput } from "$lib/types";
  import Field from "./Field.svelte";

  let { values = $bindable() }: { values: ClientInput } = $props();
</script>

<Field label="Name">
  <input class="input" bind:value={values.name} required />
</Field>
<Field label="Email">
  <input class="input" type="email" bind:value={values.email} placeholder="name@company.com" />
</Field>
<Field label="Notes">
  <textarea class="input" rows="3" bind:value={values.notes}></textarea>
</Field>
