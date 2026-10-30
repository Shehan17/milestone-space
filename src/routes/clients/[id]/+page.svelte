<script lang="ts">
  import { untrack } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import ClientForm from "$lib/components/ClientForm.svelte";
  import DeadlineLabel from "$lib/components/DeadlineLabel.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import NoteBoard from "$lib/components/NoteBoard.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ProgressBar from "$lib/components/ProgressBar.svelte";
  import ProjectAvatar from "$lib/components/ProjectAvatar.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import StatusBadge from "$lib/components/StatusBadge.svelte";
  import { deleteClient, getClient, getProjects, updateClient } from "$lib/db";
  import { onDataChanged } from "$lib/quickadd.svelte";
  import { useShortcuts } from "$lib/shortcuts.svelte";
  import { toast } from "$lib/toast.svelte";
  import type { Client, ClientInput, Project } from "$lib/types";

  let clientId = $derived(Number(page.params.id));

  let client = $state<Client | null>(null);
  let projects = $state<Project[]>([]);
  let loaded = $state(false);

  async function load(id: number) {
    const [c, all] = await Promise.all([getClient(id), getProjects()]);
    client = c;
    projects = all.filter((p) => p.client_id === id);
    loaded = true;
  }

  const reload = () => load(clientId);

  $effect(() => {
    const id = clientId;
    untrack(() => load(id));
  });

  onDataChanged(reload);

  // ----- Edit / delete -----
  let formOpen = $state(false);
  let draft = $state<ClientInput>({ name: "", email: "" });
  let confirmDelete = $state(false);

  function openEdit() {
    if (!client) return;
    draft = { name: client.name, email: client.email };
    formOpen = true;
  }

  async function save() {
    if (!draft.name.trim()) return;
    await updateClient(clientId, draft);
    formOpen = false;
    toast.success("Client saved");
    await reload();
  }

  async function remove() {
    const name = client?.name ?? "Client";
    await deleteClient(clientId);
    confirmDelete = false;
    toast.success(`“${name}” deleted`);
    await goto("/clients");
  }

  async function email(address: string) {
    try {
      await openUrl(`mailto:${address}`);
    } catch (e) {
      toast.error("Couldn't open your email app", e);
    }
  }

  let board = $state<NoteBoard>();

  useShortcuts({ n: () => board?.openNew(), e: openEdit });
</script>

{#if client}
  <PageHeader title={client.name} back={{ href: "/clients", label: "Clients" }}>
    {#snippet leading()}
      <span class="grid size-11 shrink-0 place-items-center rounded-full bg-selected text-lg font-semibold text-fg" aria-hidden="true">
        {client!.name.trim().charAt(0).toUpperCase() || "?"}
      </span>
    {/snippet}
    {#snippet meta()}
      <p class="flex min-w-0 flex-wrap items-center gap-x-1.5 text-ui text-muted">
        {#if client!.email}
          {@const address = client!.email}
          <button type="button" class="link truncate" title="Email {address}" onclick={() => email(address)}>{address}</button>
        {:else}
          <span>No email</span>
        {/if}
        <span aria-hidden="true">·</span>
        <span>{client!.project_count} {client!.project_count === 1 ? "project" : "projects"}</span>
      </p>
    {/snippet}
    {#snippet actions()}
      <button type="button" class="btn btn-secondary" title="Edit client (E)" onclick={openEdit}>
        <Icon name="edit" size={15} />Edit
      </button>
      <button type="button" class="btn btn-primary btn-lg h-10" title="New note (N)" onclick={() => board?.openNew()}>
        <Icon name="plus" size={18} />New note
      </button>
    {/snippet}
  </PageHeader>

  <div class="page space-y-8 pt-6 pb-12">
    <section aria-labelledby="client-projects">
      <h2 id="client-projects" class="mb-3 flex min-h-8 items-center gap-2 text-base font-semibold text-strong">
        Projects {#if projects.length > 0}<span class="count">{projects.length}</span>{/if}
      </h2>
      {#if projects.length > 0}
        <div class="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17.5rem),1fr))] gap-3.5">
          {#each projects as project (project.id)}
            {@const done = project.task_count - project.open_task_count}
            <a
              href="/projects/{project.id}"
              class="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong hover:bg-hover"
            >
              <div class="flex items-center gap-3">
                <ProjectAvatar name={project.name} color={project.color} size={32} />
                <p class="min-w-0 flex-1 truncate font-semibold text-strong">{project.name}</p>
              </div>
              <div class="flex items-center gap-2.5" title="{done} of {project.task_count} tasks done">
                <ProgressBar {done} total={project.task_count} color={project.color} />
                <span class="text-xs text-muted tabular-nums">{project.open_task_count} open</span>
              </div>
              <div class="flex items-center justify-between gap-3">
                <StatusBadge status={project.status} />
                <DeadlineLabel date={project.deadline} done={project.status === "completed"} empty="No date" />
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <div class="card">
          <EmptyState
            compact
            icon="projects"
            message="No projects for {client.name} yet"
            hint="Make a client project and pick {client.name} as its client: it shows up here."
          />
        </div>
      {/if}
    </section>

    <NoteBoard bind:this={board} owner={{ type: "client", id: clientId }} />
  </div>
{:else if loaded}
  <PageHeader title="Client not found" back={{ href: "/clients", label: "Clients" }} />
  <div class="page pt-5 pb-12">
    <div class="card">
      <EmptyState
        icon="clients"
        message="Client not found"
        hint="They may have been deleted."
        action={{ label: "Back to Clients", onclick: () => goto("/clients") }}
      />
    </div>
  </div>
{:else}
  <div class="page pt-24 pb-12"><div class="card"><Skeleton /></div></div>
{/if}

<Modal
  open={formOpen}
  title="Edit client"
  onclose={() => (formOpen = false)}
  onsubmit={save}
  ondelete={() => {
    formOpen = false;
    confirmDelete = true;
  }}
  deleteLabel="Delete client"
>
  <ClientForm bind:values={draft} />
</Modal>

<Modal
  open={confirmDelete}
  title="Delete client?"
  submitLabel="Delete client"
  danger
  onclose={() => (confirmDelete = false)}
  onsubmit={remove}
>
  <p class="text-sm text-fg">
    Delete <span class="font-medium text-strong">{client?.name}</span>?
    {#if client?.project_count}
      This also deletes their {client.project_count}
      {client.project_count === 1 ? "project" : "projects"} with all milestones and tasks, and their notes.
    {:else}
      Their notes are deleted too.
    {/if}
  </p>
  {#if client?.project_count}
    <p class="text-xs text-faint">This can't be undone, except by restoring a backup (Settings → Data and backup).</p>
  {/if}
</Modal>
