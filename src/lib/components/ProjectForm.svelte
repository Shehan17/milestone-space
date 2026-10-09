<script module lang="ts">
  import { PROJECT_COLORS, type ProjectInput } from "$lib/types";

  export function emptyProject(): ProjectInput {
    return {
      type: "personal",
      client_id: null,
      name: "",
      description: "",
      status: "active",
      deadline: null,
      color: PROJECT_COLORS[0],
    };
  }
</script>

<script lang="ts">
  import { PROJECT_STATUSES, PROJECT_TYPES, STATUS_LABELS, TYPE_LABELS, type ProjectType } from "$lib/types";
  import Field from "./Field.svelte";
  import Tabs from "./Tabs.svelte";

  let {
    values = $bindable(),
    clients,
  }: { values: ProjectInput; clients: { id: number; name: string }[] } = $props();

  const typeOptions = PROJECT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }));

  let isCustomColor = $derived(!PROJECT_COLORS.includes(values.color));

  function onTypeChange(type: ProjectType) {
    // Pick a client automatically so a client project is never saved without one.
    if (type === "client" && values.client_id === null) values.client_id = clients[0]?.id ?? null;
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

<div>
  <span class="mb-1.5 block text-xs font-medium text-zinc-400">Color</span>
  <div class="flex items-center gap-2">
    {#each PROJECT_COLORS as color (color)}
      <button
        type="button"
        class="size-6 cursor-pointer rounded-full ring-offset-2 ring-offset-zinc-900 {values.color === color
          ? 'ring-2 ring-zinc-200'
          : 'hover:ring-2 hover:ring-zinc-600'}"
        style="background-color: {color}"
        aria-label="Color {color}"
        aria-pressed={values.color === color}
        onclick={() => (values.color = color)}
      ></button>
    {/each}
    <label
      class="relative size-6 cursor-pointer overflow-hidden rounded-full border border-dashed border-zinc-600 ring-offset-2 ring-offset-zinc-900 {isCustomColor
        ? 'ring-2 ring-zinc-200'
        : ''}"
      style={isCustomColor ? `background-color: ${values.color}` : undefined}
      title="Custom color"
    >
      <input type="color" class="absolute inset-0 cursor-pointer opacity-0" bind:value={values.color} />
      {#if !isCustomColor}<span class="grid size-full place-items-center text-xs text-zinc-500">+</span>{/if}
    </label>
  </div>
</div>

<Field label="Description">
  <textarea class="input" rows="3" bind:value={values.description}></textarea>
</Field>
