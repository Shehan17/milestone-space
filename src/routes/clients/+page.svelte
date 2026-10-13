<script lang="ts">
  import { onMount } from "svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import ClientForm from "$lib/components/ClientForm.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import { addClient, deleteClient, getClients, updateClient } from "$lib/db";
  import { useShortcuts } from "$lib/shortcuts.svelte";
  import { toast } from "$lib/toast.svelte";
  import type { Client, ClientInput } from "$lib/types";

  let clients = $state<Client[]>([]);
  let loaded = $state(false);

  let formOpen = $state(false);
  let editingId = $state<number | null>(null);
  let draft = $state<ClientInput>({ name: "", email: "", notes: "" });
  let toDelete = $state<Client | null>(null);

  async function load() {
    clients = await getClients();
    loaded = true;
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
    toast.success(editingId === null ? "Client added" : "Client saved");
    formOpen = false;
    await load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    await deleteClient(toDelete.id);
    toast.success(`“${toDelete.name}” deleted`);
    toDelete = null;
    await load();
  }

  async function email(address: string) {
    try {
      await openUrl(`mailto:${address}`);
    } catch (e) {
      toast.error("Couldn't open your email app", e);
    }
  }

  useShortcuts({ n: openNew });
</script>

<PageHeader narrow title="Clients" subtitle="The people and companies your client projects are for.">
  {#snippet actions()}
    <button type="button" class="btn btn-primary btn-lg" onclick={openNew} title="New client (N)">
      <Icon name="plus" size={18} />New client
    </button>
  {/snippet}
</PageHeader>

<div class="page page-narrow pt-5 pb-12">
  <div class="card divide-y divide-line">
    {#if !loaded}
      <Skeleton />
    {:else}
      {#each clients as client (client.id)}
        <div class="group list-row py-3.5">
          <span class="grid size-9.5 shrink-0 place-items-center rounded-full bg-selected font-semibold text-fg" aria-hidden="true">
            {client.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <button type="button" class="min-w-0 flex-1 cursor-pointer text-left" onclick={() => openEdit(client)}>
            <p class="truncate font-medium text-strong">{client.name}</p>
            <p class="truncate text-xs text-faint" title={client.notes || undefined}>{client.email || "No email"}</p>
          </button>
          {#if client.email}
            <button
              type="button"
              class="icon-btn"
              aria-label="Email {client.name}"
              title="Email {client.email}"
              onclick={() => email(client.email)}
            >
              <Icon name="mail" size={16} />
            </button>
          {/if}
          <a
            href="/projects?client={client.id}"
            class="shrink-0 rounded-control px-2 py-1 text-xs text-muted tabular-nums transition-colors duration-150 hover:bg-selected hover:text-strong"
            title="Show {client.name}'s projects"
          >
            {client.project_count}
            {client.project_count === 1 ? "project" : "projects"}
          </a>
          <div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" class="icon-btn" aria-label="Edit client" title="Edit" onclick={() => openEdit(client)}>
              <Icon name="edit" size={16} />
            </button>
            <button
              type="button"
              class="icon-btn icon-btn-danger"
              aria-label="Delete client"
              title="Delete"
              onclick={() => (toDelete = client)}
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        </div>
      {:else}
        <EmptyState
          icon="clients"
          message="No clients yet"
          hint="Clients are for client projects: add one to link its projects to it."
          action={{ label: "New client", icon: "plus", primary: true, onclick: openNew }}
        />
      {/each}
    {/if}
  </div>
</div>

<Modal
  open={formOpen}
  title={editingId === null ? "New client" : "Edit client"}
  submitLabel={editingId === null ? "Add client" : "Save"}
  onclose={() => (formOpen = false)}
  onsubmit={save}
  ondelete={editingId === null
    ? undefined
    : () => {
        formOpen = false;
        toDelete = clients.find((c) => c.id === editingId) ?? null;
      }}
  deleteLabel="Delete client"
>
  <ClientForm bind:values={draft} />
</Modal>

<Modal
  open={toDelete !== null}
  title="Delete client?"
  submitLabel="Delete client"
  danger
  onclose={() => (toDelete = null)}
  onsubmit={confirmDelete}
>
  <p class="text-sm text-fg">
    Delete <span class="font-medium text-strong">{toDelete?.name}</span>?
    {#if toDelete?.project_count}
      This also deletes their {toDelete.project_count}
      {toDelete.project_count === 1 ? "project" : "projects"} with all milestones and tasks.
    {/if}
  </p>
  {#if toDelete?.project_count}
    <p class="text-xs text-faint">This can't be undone, except by restoring a backup (Settings → Data and backup).</p>
  {/if}
</Modal>
