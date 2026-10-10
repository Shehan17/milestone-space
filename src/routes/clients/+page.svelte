<script lang="ts">
  import { onMount } from "svelte";
  import ClientForm from "$lib/components/ClientForm.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import { addClient, deleteClient, getClients, updateClient } from "$lib/db";
  import type { Client, ClientInput } from "$lib/types";
  import { useShortcuts } from "$lib/shortcuts.svelte";

  let clients = $state<Client[]>([]);

  let formOpen = $state(false);
  let editingId = $state<number | null>(null);
  let draft = $state<ClientInput>({ name: "", email: "", notes: "" });
  let toDelete = $state<Client | null>(null);

  async function load() {
    clients = await getClients();
  }

  onMount(load);

  function openNew() {
    editingId = null;
    draft = { name: "", email: "", notes: "" };
    formOpen = true;
  }

  function openEdit(client: Client) {
    editingId = client.id;
    draft = { name: client.name, email: client.email, notes: client.notes };
    formOpen = true;
  }

  async function save() {
    if (!draft.name.trim()) return;
    if (editingId === null) await addClient(draft);
    else await updateClient(editingId, draft);
    formOpen = false;
    await load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await deleteClient(toDelete.id);
    toDelete = null;
    await load();
  }

  useShortcuts({ n: openNew });
</script>

<PageHeader title="Clients" subtitle="{clients.length} total">
  {#snippet actions()}
    <button type="button" class="btn btn-primary" onclick={openNew}><Icon name="plus" size={14} />New client</button>
  {/snippet}
</PageHeader>

<div class="px-8 py-6">
  <div class="card divide-y divide-zinc-800/70">
    {#each clients as client (client.id)}
      <div class="group flex items-center gap-4 px-4 py-2.5">
        <div class="w-56 min-w-0 shrink-0">
          <p class="truncate text-sm font-medium text-zinc-100">{client.name}</p>
          <p class="truncate text-xs text-zinc-500">{client.email || "No email"}</p>
        </div>
        <p class="min-w-0 flex-1 truncate text-xs text-zinc-500">{client.notes}</p>
        <span class="shrink-0 text-xs text-zinc-400 tabular-nums">
          {client.project_count}
          {client.project_count === 1 ? "project" : "projects"}
        </span>
        <div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" class="icon-btn" aria-label="Edit client" onclick={() => openEdit(client)}>
            <Icon name="edit" size={14} />
          </button>
          <button
            type="button"
            class="icon-btn hover:text-red-400"
            aria-label="Delete client"
            onclick={() => (toDelete = client)}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      </div>
    {:else}
      <EmptyState message="No clients yet. Add your first client to get started." />
    {/each}
  </div>
</div>

<Modal
  open={formOpen}
  title={editingId === null ? "New client" : "Edit client"}
  onclose={() => (formOpen = false)}
  onsubmit={save}
>
  <ClientForm bind:values={draft} />
</Modal>

<Modal
  open={toDelete !== null}
  title="Delete client"
  submitLabel="Delete"
  danger
  onclose={() => (toDelete = null)}
  onsubmit={confirmDelete}
>
  <p class="text-sm text-zinc-300">
    Delete <span class="font-medium text-zinc-100">{toDelete?.name}</span>? This also deletes their
    {toDelete?.project_count ?? 0} project(s) with all milestones and tasks.
  </p>
</Modal>
