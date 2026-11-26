<script lang="ts">
  import type { Client, TaskMention } from "$lib/types";
  import Icon from "./Icon.svelte";
  import Modal from "./Modal.svelte";

  let {
    open,
    clients = [],
    selected = [],
    onchange,
    onclose,
  }: {
    open: boolean;
    clients?: Pick<Client, "id" | "name" | "email">[];
    selected: TaskMention[];
    onchange?: (next: TaskMention[]) => void;
    onclose: () => void;
  } = $props();

  let search = $state("");
  let name = $state("");
  let contact = $state("");
  let error = $state("");

  let matching = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  });

  function isPicked(clientId: number) {
    return selected.some((m) => m.client_id === clientId);
  }

  function set(next: TaskMention[]) {
    onchange?.(next);
    error = "";
  }

  function toggleClient(client: Pick<Client, "id" | "name" | "email">) {
    if (isPicked(client.id)) set(selected.filter((m) => m.client_id !== client.id));
    else set([...selected, { client_id: client.id, name: client.name, contact: client.email }]);
  }

  function addPerson() {
    const cleanName = name.trim();
    const cleanContact = contact.trim();
    if (!cleanName) {
      error = "Give the person a name";
      return;
    }
    if (!cleanContact) {
      error = "Add an email address or phone number";
      return;
    }
    const duplicate = selected.some(
      (m) =>
        m.client_id === null &&
        m.name.toLowerCase() === cleanName.toLowerCase() &&
        m.contact.toLowerCase() === cleanContact.toLowerCase()
    );
    if (duplicate) {
      error = "That person is already mentioned";
      return;
    }
    set([...selected, { client_id: null, name: cleanName, contact: cleanContact }]);
    name = "";
    contact = "";
  }

  function removeAt(index: number) {
    set(selected.filter((_, i) => i !== index));
  }

  function noEnter(event: KeyboardEvent) {
    if (event.key === "Enter") event.preventDefault();
  }

  function addOnEnter(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      addPerson();
    }
  }
</script>

<Modal
  {open}
  title="Mention person"
  description="Search an existing client, or add someone with their email or phone number."
  size="lg"
  submitLabel="Done"
  onclose={onclose}
  onsubmit={onclose}
>
  <div class="space-y-3">
    <input
      class="input"
      bind:value={search}
      placeholder="Search clients by name or email"
      aria-label="Search clients"
      data-autofocus
      onkeydown={noEnter}
    />

    <div class="-mx-6 max-h-56 overflow-y-auto border-y border-line px-6 py-1">
      {#each matching as client (client.id)}
        <button
          type="button"
          class="list-row w-full text-left"
          aria-pressed={isPicked(client.id)}
          onclick={() => toggleClient(client)}
        >
          {#if isPicked(client.id)}
            <span class="text-accent-text"><Icon name="check" size={14} /></span>
          {:else}
            <span class="size-3.5 shrink-0"></span>
          {/if}
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm text-fg">{client.name}</span>
            {#if client.email}<span class="block truncate text-xs text-muted">{client.email}</span>{/if}
          </span>
          <span class="badge shrink-0">Client</span>
        </button>
      {:else}
        <p class="py-4 text-center text-xs text-faint">No clients found.</p>
      {/each}
    </div>

    <div class="rounded-item border border-line bg-field p-3">
      <p class="mb-2 text-xs font-medium text-muted">Other person</p>
      <div class="grid gap-2 sm:grid-cols-2">
        <input
          class="input"
          bind:value={name}
          placeholder="Name"
          aria-label="Person name"
          onkeydown={addOnEnter}
        />
        <input
          class="input"
          bind:value={contact}
          placeholder="Email or phone number"
          aria-label="Email or phone number"
          onkeydown={addOnEnter}
        />
      </div>
      <div class="mt-2 flex items-center gap-2">
        <button type="button" class="btn btn-secondary btn-sm" onclick={addPerson}>Add person</button>
        {#if error}<span class="text-xs text-danger">{error}</span>{/if}
      </div>
    </div>

    {#if selected.length > 0}
      <div>
        <p class="mb-1 text-xs font-medium text-muted">Mentioned</p>
        <div class="flex flex-wrap gap-1.5">
          {#each selected as person, i (i)}
            <button
              type="button"
              class="chip chip-on flex max-w-56 items-center gap-1.5"
              title="Remove {person.name}"
              onclick={() => removeAt(i)}
            >
              <Icon name={person.client_id === null ? "clients" : "projects"} size={12} />
              <span class="truncate">{person.name}</span>
              <span class="truncate text-2xs opacity-70">{person.contact}</span>
              <Icon name="x" size={12} />
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</Modal>
