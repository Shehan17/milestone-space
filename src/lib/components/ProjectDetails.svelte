<script lang="ts">
  import {
    addProjectDetail,
    deleteProjectDetail,
    getProjectDetails,
    moveProjectDetail,
    updateProjectDetail,
  } from "$lib/db";
  import { toast } from "$lib/toast.svelte";
  import type { ProjectDetail } from "$lib/types";
  import Icon from "./Icon.svelte";

  let { projectId }: { projectId: number } = $props();

  let details = $state<ProjectDetail[]>([]);
  let loaded = $state(false);

  async function load() {
    details = await getProjectDetails(projectId);
    loaded = true;
  }

  $effect(() => {
    load();
  });

  // ----- Add -----
  let newLabel = $state("");
  let newValue = $state("");
  let labelInput = $state<HTMLInputElement>();

  let adding = false; // ignores a second Enter while the first add is still saving

  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (adding || !newLabel.trim()) return;
    adding = true;
    try {
      await addProjectDetail({ project_id: projectId, label: newLabel, value: newValue });
      newLabel = "";
      newValue = "";
      await load();
    } finally {
      adding = false;
    }
    labelInput?.focus();
  }

  // ----- Inline edit: each field is saved on its own when it loses focus -----
  async function saveField(detail: ProjectDetail, field: "label" | "value", text: string) {
    if (text.trim() === detail[field]) return;
    await updateProjectDetail(detail.id, field, text);
    await load();
    toast.success("Saved", { duration: 1500 });
  }

  async function remove(detail: ProjectDetail) {
    const undo = await deleteProjectDetail(detail.id);
    await load();
    toast.undo(`“${detail.label}” deleted`, async () => {
      await undo();
      await load();
    });
  }

  async function move(detail: ProjectDetail, direction: -1 | 1) {
    await moveProjectDetail(detail.id, direction);
    await load();
  }

  // ----- Copy -----
  let copiedId = $state<number | null>(null);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  async function copy(detail: ProjectDetail) {
    await navigator.clipboard.writeText(detail.value);
    copiedId = detail.id;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copiedId = null), 1500);
  }

  function blurOnEnter(event: KeyboardEvent) {
    if (event.key === "Enter") (event.currentTarget as HTMLInputElement).blur();
  }

  const fieldClass =
    "rounded-control border border-transparent bg-transparent px-1.5 py-1 text-sm transition-colors duration-150 hover:border-line focus:border-accent focus:bg-field focus:outline-none";
</script>

<section class="card min-w-0">
  <div class="card-header">
    <h2 class="card-title">Details <span class="count">{details.length}</span></h2>
  </div>
  {#each details as detail, i (detail.id)}
    <div class="group flex items-center gap-2 px-2.5 py-1 transition-colors duration-150 hover:bg-hover">
      <input
        class="{fieldClass} w-32 shrink-0 text-muted"
        value={detail.label}
        aria-label="Label"
        title="Click to edit"
        onkeydown={blurOnEnter}
        onblur={(e) => {
          // An emptied label restores the old one rather than saving a blank row.
          if (!e.currentTarget.value.trim()) e.currentTarget.value = detail.label;
          else saveField(detail, "label", e.currentTarget.value);
        }}
      />
      <input
        class="{fieldClass} min-w-0 flex-1 text-fg"
        value={detail.value}
        placeholder="Empty"
        aria-label="{detail.label} value"
        title="Click to edit"
        onkeydown={blurOnEnter}
        onblur={(e) => saveField(detail, "value", e.currentTarget.value)}
      />
      <button
        type="button"
        class="icon-btn {copiedId === detail.id ? 'text-accent-text' : ''}"
        aria-label="Copy value"
        title={copiedId === detail.id ? "Copied" : "Copy value"}
        onclick={() => copy(detail)}
      >
        <Icon name={copiedId === detail.id ? "check" : "copy"} size={14} />
      </button>
      <div class="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <button type="button" class="icon-btn disabled:invisible" aria-label="Move up" disabled={i === 0} onclick={() => move(detail, -1)}>
          <Icon name="up" size={14} />
        </button>
        <button
          type="button"
          class="icon-btn disabled:invisible"
          aria-label="Move down"
          disabled={i === details.length - 1}
          onclick={() => move(detail, 1)}
        >
          <Icon name="down" size={14} />
        </button>
        <button type="button" class="icon-btn icon-btn-danger" aria-label="Delete detail" onclick={() => remove(detail)}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  {:else}
    {#if loaded}
      <p class="px-4 pt-4 pb-1 text-xs text-faint">
        No details yet. Add things you look up often: tech stack, version, account IDs, contact person.
      </p>
    {/if}
  {/each}
  <form class="flex items-center gap-2 border-t border-line px-4 py-2.5 {details.length === 0 ? 'mt-3' : ''}" onsubmit={add}>
    <input class="input input-sm w-32 shrink-0" placeholder="Label" aria-label="New detail label" bind:value={newLabel} bind:this={labelInput} />
    <input class="input input-sm min-w-0 flex-1" placeholder="Value" aria-label="New detail value" bind:value={newValue} />
    <button type="submit" class="btn btn-secondary btn-sm" disabled={!newLabel.trim()}>
      <Icon name="plus" size={12} />Add
    </button>
  </form>
</section>
