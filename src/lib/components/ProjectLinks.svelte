<script lang="ts">
  import { openPath, openUrl } from "@tauri-apps/plugin-opener";
  import {
    addProjectLink,
    deleteProjectLink,
    getProjectLinks,
    moveProjectLink,
    updateProjectLink,
  } from "$lib/db";
  import { LINK_TYPE_LABELS, type LinkType, type ProjectLink, type ProjectLinkInput } from "$lib/types";
  import EmptyState from "./EmptyState.svelte";
  import Icon, { type IconName } from "./Icon.svelte";
  import LinkForm from "./LinkForm.svelte";
  import Modal from "./Modal.svelte";

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

  async function load() {
    links = await getProjectLinks(projectId);
  }

  $effect(() => {
    load();
  });

  /** A Windows path like "G:\My Drive\designs" or "\\server\share". */
  const isLocalPath = (url: string) => /^[a-z]:[\\/]|^\\\\/i.test(url);

  /** "github.com/me/repo" → "https://github.com/me/repo", so the opener accepts it. Paths stay as they are. */
  function normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (isLocalPath(trimmed) || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  /** Web links open in the default browser, local paths in Explorer (or their default app). */
  function open(link: ProjectLink) {
    return isLocalPath(link.url) ? openPath(link.url) : openUrl(link.url);
  }

  let formOpen = $state(false);
  let editingId = $state<number | null>(null);
  let draft = $state<ProjectLinkInput>({ project_id: 0, title: "", url: "", type: "other" });
  let linkToDelete = $state<ProjectLink | null>(null);

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
    formOpen = false;
    await load();
  }

  async function remove() {
    if (!linkToDelete) return;
    await deleteProjectLink(linkToDelete.id);
    linkToDelete = null;
    await load();
  }

  async function move(link: ProjectLink, direction: -1 | 1) {
    await moveProjectLink(link.id, direction);
    await load();
  }
</script>

<section class="card min-w-0">
  <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
    <h2 class="text-xs font-semibold text-zinc-300">Links <span class="ml-1 text-zinc-500">{links.length}</span></h2>
    <button type="button" class="btn btn-ghost px-2 py-1 text-xs" onclick={openNew}>
      <Icon name="plus" size={12} />Add link
    </button>
  </div>
  {#each links as link, i (link.id)}
    <div class="group flex items-center gap-3 px-4 py-2 hover:bg-zinc-800/30">
      <span class="shrink-0 text-violet-400" title={LINK_TYPE_LABELS[link.type]}>
        <Icon name={TYPE_ICONS[link.type]} size={16} />
      </span>
      <button
        type="button"
        class="min-w-0 flex-1 cursor-pointer text-left"
        title="Open {link.url}"
        onclick={() => open(link)}
      >
        <p class="truncate text-sm text-zinc-200 group-hover:text-violet-300">{link.title}</p>
        <p class="truncate text-xs text-zinc-500">{link.url}</p>
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
        <button type="button" class="icon-btn hover:text-red-400" aria-label="Delete link" onclick={() => (linkToDelete = link)}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  {:else}
    <EmptyState message="No links yet." />
  {/each}
</section>

<Modal open={formOpen} title={editingId === null ? "New link" : "Edit link"} onclose={() => (formOpen = false)} onsubmit={save}>
  <LinkForm bind:values={draft} />
</Modal>

<Modal
  open={linkToDelete !== null}
  title="Delete link"
  submitLabel="Delete"
  danger
  onclose={() => (linkToDelete = null)}
  onsubmit={remove}
>
  <p class="text-sm text-zinc-300">Delete <span class="font-medium text-zinc-100">{linkToDelete?.title}</span>?</p>
</Modal>
