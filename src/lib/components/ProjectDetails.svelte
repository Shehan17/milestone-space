<script lang="ts">
  import {
    addProjectDetail,
    deleteProjectDetail,
    getProjectDetails,
    moveProjectDetail,
    updateProjectDetail,
  } from "$lib/db";
  import type { ProjectDetail } from "$lib/types";
  import EmptyState from "./EmptyState.svelte";
  import Icon from "./Icon.svelte";

  let { projectId }: { projectId: number } = $props();

  let details = $state<ProjectDetail[]>([]);

  async function load() {
    details = await getProjectDetails(projectId);
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
  }

  async function remove(detail: ProjectDetail) {
    await deleteProjectDetail(detail.id);
    await load();
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
    "rounded border border-transparent bg-transparent px-1.5 py-1 text-sm hover:border-zinc-800 focus:border-violet-500 focus:bg-zinc-950 focus:outline-none";
</script>

<section class="card min-w-0">
  <div class="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
    <h2 class="text-xs font-semibold text-zinc-300">Details <span class="ml-1 text-zinc-500">{details.length}</span></h2>
  </div>
  {#each details as detail, i (detail.id)}
    <div class="group flex items-center gap-2 px-2.5 py-1 hover:bg-zinc-800/30">
      <input
        class="{fieldClass} w-32 shrink-0 text-zinc-500"
        value={detail.label}
        aria-label="Label"
        onkeydown={blurOnEnter}
        onblur={(e) => {
          // An emptied label restores the old one rather than saving a blank row.
          if (!e.currentTarget.value.trim()) e.currentTarget.value = detail.label;
          else saveField(detail, "label", e.currentTarget.value);
        }}
      />
      <input
        class="{fieldClass} min-w-0 flex-1 text-zinc-200"
        value={detail.value}
        placeholder="Empty"
        aria-label="{detail.label} value"
        onkeydown={blurOnEnter}
        onblur={(e) => saveField(detail, "value", e.currentTarget.value)}
      />
      <button
        type="button"
        class="icon-btn shrink-0 {copiedId === detail.id ? 'text-emerald-400' : ''}"
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
        <button type="button" class="icon-btn hover:text-red-400" aria-label="Delete detail" onclick={() => remove(detail)}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  {:else}
    <EmptyState message="No details yet. Add things like tech stack, version, or IDs." />
  {/each}
  <form class="flex items-center gap-2 border-t border-zinc-800 px-4 py-2.5" onsubmit={add}>
    <input class="input w-32 shrink-0" placeholder="Label" bind:value={newLabel} bind:this={labelInput} />
    <input class="input min-w-0 flex-1" placeholder="Value" bind:value={newValue} />
    <button type="submit" class="btn btn-ghost px-2 py-1 text-xs" disabled={!newLabel.trim()}>
      <Icon name="plus" size={12} />Add
    </button>
  </form>
</section>
