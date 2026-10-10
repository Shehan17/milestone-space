<script module lang="ts">
  import { settings } from "$lib/settings.svelte";
  import { PROJECT_COLORS, type ProjectInput } from "$lib/types";

  /** A blank project with the default type from Settings. */
  export function emptyProject(): ProjectInput {
    return {
      type: settings.default_project_type,
      client_id: null,
      name: "",
      description: "",
      status: "active",
      deadline: null,
      color: PROJECT_COLORS[0],
      local_path: null,
    };
  }
</script>

<script lang="ts">
  import { PROJECT_STATUSES, PROJECT_TYPES, STATUS_LABELS, TYPE_LABELS, type ProjectType } from "$lib/types";
  import { open } from "@tauri-apps/plugin-dialog";
  import ColorPicker from "./ColorPicker.svelte";
  import Field from "./Field.svelte";
  import Tabs from "./Tabs.svelte";

  let {
    values = $bindable(),
    clients,
  }: { values: ProjectInput; clients: { id: number; name: string }[] } = $props();

  const typeOptions = PROJECT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }));

  function onTypeChange(type: ProjectType) {
    // Pick a client automatically so a client project is never saved without one.
    if (type === "client" && values.client_id === null) values.client_id = clients[0]?.id ?? null;
  }

  async function browseFolder() {
    const folder = await open({ directory: true, defaultPath: values.local_path || undefined, title: "Project folder" });
    if (typeof folder === "string") values.local_path = folder;
  }
</script>

<div>
  <span class="mb-1 block text-xs font-medium text-zinc-400">Type</span>
  <Tabs options={typeOptions} bind:value={values.type} onchange={onTypeChange} />
</div>

<Field label="Name">
  <input class="input" bind:value={values.name} required />
</Field>

{#if values.type === "client"}
  {#if clients.length > 0}
    <Field label="Client">
      <select class="input" bind:value={values.client_id}>
        {#each clients as client (client.id)}
          <option value={client.id}>{client.name}</option>
        {/each}
      </select>
    </Field>
  {:else}
    <p class="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
      No clients yet. Add one on the <a href="/clients" class="underline">Clients</a> page first.
    </p>
  {/if}
{/if}

<div class="grid grid-cols-2 gap-3">
  <Field label="Status">
    <select class="input" bind:value={values.status}>
      {#each PROJECT_STATUSES as status (status)}
        <option value={status}>{STATUS_LABELS[status]}</option>
      {/each}
    </select>
  </Field>
  <Field label="Deadline">
    <input class="input" type="date" bind:value={values.deadline} />
  </Field>
</div>

<ColorPicker bind:value={values.color} />

<Field label="Local folder">
  <div class="flex gap-2">
    <input class="input" bind:value={values.local_path} placeholder="C:\Users\you\Projects\my-project" />
    <button type="button" class="btn btn-ghost shrink-0 border border-zinc-800" onclick={browseFolder}>Browse…</button>
  </div>
</Field>

<Field label="Description">
  <textarea class="input" rows="3" bind:value={values.description}></textarea>
</Field>
