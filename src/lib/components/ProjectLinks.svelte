<script lang="ts">
  import { openPath, openUrl } from "@tauri-apps/plugin-opener";
  import {
    addProjectLink,
    deleteProjectLink,
    getProjectLinks,
    moveProjectLink,
    updateProjectLink,
  } from "$lib/db";
  import { isLocalPath, normalizeUrl } from "$lib/links";
  import { toast } from "$lib/toast.svelte";
  import { LINK_TYPE_LABELS, type LinkType, type ProjectLink, type ProjectLinkInput } from "$lib/types";
  import EmptyState from "./EmptyState.svelte";
  import Icon, { type IconName } from "./Icon.svelte";
  import LinkForm from "./LinkForm.svelte";
  import Modal from "./Modal.svelte";
  import Skeleton from "./Skeleton.svelte";

  let { projectId }: { projectId: number } = $props();

  const TYPE_ICONS: Record<LinkType, IconName> = {
    github: "github",
    figma: "figma",
    drive: "drive",
    store: "store",
    website: "globe",
    docs: "docs",
    other: "link",
  };

  let links = $state<ProjectLink[]>([]);
  let loaded = $state(false);

  async function load() {
    links = await getProjectLinks(projectId);
    loaded = true;
  }

  $effect(() => {
    load();
  });

  /** Web links open in the default browser, local paths in Explorer (or their default app). */
  async function open(link: ProjectLink) {
    try {
      await (isLocalPath(link.url) ? openPath(link.url) : openUrl(link.url));
    } catch (e) {
      toast.error(`Couldn't open “${link.title}”`, e);
    }
  }

  let formOpen = $state(false);
  let editingId = $state<number | null>(null);
  let draft = $state<ProjectLinkInput>({ project_id: 0, title: "", url: "", type: "other" });

  function openNew() {
    editingId = null;
    draft = { project_id: projectId, title: "", url: "", type: "other" };
    formOpen = true;
  }

  function openEdit(link: ProjectLink) {
    editingId = link.id;
    draft = { project_id: link.project_id, title: link.title, url: link.url, type: link.type };
    formOpen = true;
  }

  async function save() {
    if (!draft.title.trim() || !draft.url.trim()) return;
    const input = { ...draft, url: normalizeUrl(draft.url) };
    if (editingId === null) await addProjectLink(input);
    else await updateProjectLink(editingId, input);
    toast.success(editingId === null ? "Link added" : "Link saved");
    formOpen = false;
    await load();
  }

  async function remove(link: ProjectLink) {
    const undo = await deleteProjectLink(link.id);
    await load();
    toast.undo(`Link “${link.title}” deleted`, async () => {
      await undo();
      await load();
    });
  }

  async function move(link: ProjectLink, direction: -1 | 1) {
    await moveProjectLink(link.id, direction);
    await load();
  }
</script>

<section class="card min-w-0">
  <div class="card-header">
    <h2 class="card-title">Links <span class="count">{links.length}</span></h2>
    <button type="button" class="btn btn-ghost btn-sm" onclick={openNew}>
      <Icon name="plus" size={12} />Add link
    </button>
  </div>
  {#each links as link, i (link.id)}
    <div class="group list-row">
      <span class="text-accent-text" title={LINK_TYPE_LABELS[link.type]}>
        <Icon name={TYPE_ICONS[link.type]} size={16} />
      </span>
      <button type="button" class="min-w-0 flex-1 cursor-pointer text-left" title="Open {link.url}" onclick={() => open(link)}>
        <p class="truncate text-sm text-fg group-hover:text-accent-text-strong">{link.title}</p>
        <p class="truncate text-xs text-faint">{link.url}</p>
      </button>
      <div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <button type="button" class="icon-btn disabled:invisible" aria-label="Move up" disabled={i === 0} onclick={() => move(link, -1)}>
          <Icon name="up" size={14} />
        </button>
        <button
          type="button"
          class="icon-btn disabled:invisible"
          aria-label="Move down"
          disabled={i === links.length - 1}
          onclick={() => move(link, 1)}
        >
          <Icon name="down" size={14} />
        </button>
        <button type="button" class="icon-btn" aria-label="Edit link" onclick={() => openEdit(link)}>
          <Icon name="edit" size={14} />
        </button>
        <button type="button" class="icon-btn icon-btn-danger" aria-label="Delete link" onclick={() => remove(link)}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  {:else}
    {#if loaded}
      <EmptyState
        compact
        message="No links yet"
        hint="Keep the repository, designs and docs one click away."
        action={{ label: "Add link", icon: "plus", onclick: openNew }}
      />
    {:else}
      <Skeleton rows={2} />
    {/if}
  {/each}
</section>

<Modal
  open={formOpen}
  title={editingId === null ? "New link" : "Edit link"}
  onclose={() => (formOpen = false)}
  onsubmit={save}
  ondelete={editingId === null
    ? undefined
    : () => {
        const link = links.find((l) => l.id === editingId);
        formOpen = false;
        if (link) remove(link);
      }}
>
  <LinkForm bind:values={draft} />
</Modal>
