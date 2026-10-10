<script lang="ts">
  import { onMount } from "svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import TaskForm, { emptyTask } from "$lib/components/TaskForm.svelte";
  import { addInboxItem, addTask, deleteInboxItem, getInboxItems, getMilestones, getProjects } from "$lib/db";
  import { timeAgo, todayString } from "$lib/dates";
  import { onInboxChanged, refreshInboxCount } from "$lib/inbox.svelte";
  import { quickCaptureKeys } from "$lib/settings.svelte";
  import { useShortcuts } from "$lib/shortcuts.svelte";
  import type { InboxItem, Milestone, Project, TaskInput } from "$lib/types";

  let items = $state<InboxItem[]>([]);
  let projects = $state<Project[]>([]);
  let milestones = $state<Milestone[]>([]);

  async function load() {
    const [i, p, m] = await Promise.all([getInboxItems(), getProjects(), getMilestones()]);
    items = i;
    projects = p;
    milestones = m;
    await refreshInboxCount();
  }

  // Also reload when the quick capture window adds something while this page is open.
  onMount(() => {
    load();
    return onInboxChanged(load);
  });

  // ----- Add from inside the app -----
  let newText = $state("");
  let newInput = $state<HTMLInputElement>();

  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (!newText.trim()) return;
    await addInboxItem(newText);
    newText = "";
    await load();
  }

  async function remove(item: InboxItem) {
    await deleteInboxItem(item.id);
    await load();
  }

  // ----- Turn an item into a task -----
  let openProjects = $derived(projects.filter((p) => p.status !== "completed"));
  let converting = $state<InboxItem | null>(null);
  let draft = $state<TaskInput>(emptyTask(0));
  let planToday = $state(false);

  function openConvert(item: InboxItem) {
    converting = item;
    draft = emptyTask(openProjects[0]?.id ?? 0, { title: item.text });
    planToday = false;
  }

  async function saveTask() {
    if (!converting || !draft.title.trim() || !draft.project_id) return;
    await addTask(draft, planToday ? todayString() : null);
    await deleteInboxItem(converting.id);
    converting = null;
    await load();
  }

  useShortcuts({ n: () => newInput?.focus() });
</script>

<PageHeader title="Inbox" subtitle="Ideas and tasks captured with {quickCaptureKeys()}, waiting to be sorted" />

<div class="max-w-4xl space-y-4 px-8 py-6">
  <form class="flex gap-2" onsubmit={add}>
    <input bind:this={newInput} bind:value={newText} class="input" placeholder="Add an idea or task…" aria-label="New inbox item" />
    <button type="submit" class="btn btn-primary shrink-0" disabled={!newText.trim()}><Icon name="plus" size={14} />Add</button>
  </form>

  <div class="card divide-y divide-zinc-800/70">
    {#each items as item (item.id)}
      <div class="group flex items-center gap-3 px-4 py-2 hover:bg-zinc-800/30">
        <p class="min-w-0 flex-1 text-sm break-words text-zinc-200">{item.text}</p>
        <span class="shrink-0 text-xs text-zinc-500" title={item.created_at}>{timeAgo(item.created_at)}</span>
        <button
          type="button"
          class="btn btn-ghost shrink-0 px-2 py-1 text-xs"
          onclick={() => openConvert(item)}
          disabled={openProjects.length === 0}
          title={openProjects.length === 0 ? "Create a project first" : "Move it into a project as a task"}
        >
          <Icon name="tasks" size={12} />Make task
        </button>
        <button type="button" class="icon-btn shrink-0 hover:text-red-400" aria-label="Delete {item.text}" title="Delete" onclick={() => remove(item)}>
          <Icon name="trash" size={14} />
        </button>
      </div>
    {:else}
      <EmptyState message="Inbox zero. Press {quickCaptureKeys()} anywhere to capture an idea." />
    {/each}
  </div>
</div>

<Modal open={converting !== null} title="Make task" submitLabel="Create task" onclose={() => (converting = null)} onsubmit={saveTask}>
  <TaskForm bind:values={draft} projects={openProjects} {milestones} />
  <label class="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
    <input type="checkbox" class="checkbox" bind:checked={planToday} />Add to Today
  </label>
</Modal>
