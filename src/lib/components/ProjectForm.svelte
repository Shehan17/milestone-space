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
  import { addClient, getClients } from "$lib/db";
  import { toast } from "$lib/toast.svelte";
  import ColorPicker from "./ColorPicker.svelte";
  import DateInput from "./DateInput.svelte";
  import Field from "./Field.svelte";
  import Icon from "./Icon.svelte";
  import Tabs from "./Tabs.svelte";

  let {
    values = $bindable(),
    clients = $bindable(),
  }: { values: ProjectInput; clients: { id: number; name: string }[] } = $props();

  const uid = $props.id();

  const typeOptions = PROJECT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }));
  const statusOptions = PROJECT_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }));

  function onTypeChange(type: ProjectType) {
    // Pick a client automatically so a client project is never saved without one.
    if (type === "client" && values.client_id === null) values.client_id = clients[0]?.id ?? null;
  }

  async function browseFolder() {
    const folder = await open({ directory: true, defaultPath: values.local_path || undefined, title: "Project folder" });
    if (typeof folder === "string") values.local_path = folder;
  }

  // ----- A new client made right here, so a client project never needs a trip to the Clients page -----
  let addingClient = $state(false); // with no clients yet, the name field shows anyway
  let newClient = $state("");
  let savingClient = $state(false);

  async function createClient() {
    const name = newClient.trim();
    if (!name || savingClient) return;
    savingClient = true;
    try {
      const id = await addClient({ name, email: "", notes: "" });
      clients = await getClients();
      values.client_id = id;
      newClient = "";
      addingClient = false;
      toast.success(`Client “${name}” added`);
    } finally {
      savingClient = false;
    }
  }

  function onNewClientKey(event: KeyboardEvent) {
    // Enter adds the client instead of saving the whole project.
    if (event.key === "Enter" && !event.ctrlKey) {
      event.preventDefault();
      createClient();
    }
  }
</script>

<Field label="Name" error={values.name.trim() ? null : "Give the project a name"}>
  <input class="input" bind:value={values.name} required data-autofocus placeholder="e.g. Website redesign" />
</Field>

<div>
  <span class="mb-1 block text-xs font-medium text-muted">Type</span>
  <Tabs options={typeOptions} bind:value={values.type} onchange={onTypeChange} label="Project type" />
</div>

{#if values.type === "client"}
  <Field
    label="Client"
    for="{uid}-client"
    error={values.client_id === null ? (clients.length ? "Choose a client" : "Add the client for this project") : null}
  >
    {#if addingClient || clients.length === 0}
      <div class="flex gap-2">
        <input
          id="{uid}-client"
          class="input"
          placeholder="New client name"
          bind:value={newClient}
          onkeydown={onNewClientKey}
        />
        <button type="button" class="btn btn-secondary shrink-0" disabled={!newClient.trim() || savingClient} onclick={createClient}>
          Add client
        </button>
        {#if clients.length > 0}
          <button type="button" class="btn btn-ghost shrink-0" onclick={() => (addingClient = false)}>Cancel</button>
        {/if}
      </div>
    {:else}
      <div class="flex gap-2">
        <select id="{uid}-client" class="input" bind:value={values.client_id}>
          {#each clients as client (client.id)}
            <option value={client.id}>{client.name}</option>
          {/each}
        </select>
        <button type="button" class="btn btn-secondary shrink-0" onclick={() => (addingClient = true)}>
          <Icon name="plus" size={14} />New
        </button>
      </div>
    {/if}
  </Field>
{/if}

<div>
  <span class="mb-1 block text-xs font-medium text-muted">Status</span>
  <Tabs options={statusOptions} bind:value={values.status} label="Project status" />
</div>

<Field label="Deadline" for="{uid}-deadline">
  <DateInput id="{uid}-deadline" bind:value={values.deadline} />
</Field>

<ColorPicker bind:value={values.color} />

<Field label="Local folder" for="{uid}-folder" hint="Adds Open folder and VS Code buttons to the project.">
  <div class="flex gap-2">
    <input id="{uid}-folder" class="input" bind:value={values.local_path} placeholder="C:\Users\you\Projects\my-project" />
    <button type="button" class="btn btn-secondary shrink-0" onclick={browseFolder}>Browse…</button>
  </div>
</Field>

<Field label="Description">
  <textarea class="input" rows="3" bind:value={values.description} placeholder="What is this project about?"></textarea>
</Field>
