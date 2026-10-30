<script lang="ts">
  import type { ClientInput } from "$lib/types";
  import Field from "./Field.svelte";

  let { values = $bindable() }: { values: ClientInput } = $props();

  const emailOk = (email: string) => !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
</script>

<Field label="Name" error={values.name.trim() ? null : "Give the client a name"}>
  <input class="input" bind:value={values.name} required data-autofocus />
</Field>
<Field label="Email" error={emailOk(values.email) ? null : "That doesn't look like an email address"}>
  <input class="input" type="email" bind:value={values.email} placeholder="name@company.com" />
</Field>
