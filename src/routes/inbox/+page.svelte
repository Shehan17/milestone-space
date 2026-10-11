<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import TaskForm, { defaultProjectId, emptyTask, rememberProject } from "$lib/components/TaskForm.svelte";
  import { addInboxItem, addTask, deleteInboxItem, getInboxItems, getMilestones, getProjects } from "$lib/db";
  import { timeAgo, todayString } from "$lib/dates";
  import { onInboxChanged, refreshInboxCount } from "$lib/inbox.svelte";
  import { quickCaptureKeys } from "$lib/settings.svelte";
  import { useShortcuts } from "$lib/shortcuts.svelte";
  import { toast } from "$lib/toast.svelte";
  import type { InboxItem, Milestone, Project, TaskInput } from "$lib/types";

  let items = $state<InboxItem[]>([]);
  let projects = $state<Project[]>([]);
  let milestones = $state<Milestone[]>([]);
  let loaded = $state(false);

  async function load() {
    const [i, p, m] = await Promise.all([getInboxItems(), getProjects(), getMilestones()]);
    items = i;
    projects = p;
    milestones = m;
    loaded = true;
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
    const undo = await deleteInboxItem(item.id);
    await load();
    toast.undo("Inbox item deleted", async () => {
      await undo();
      await load();
    });
  }

  // ----- Turn an item into a task -----
  let openProjects = $derived(projects.filter((p) => p.status !== "completed"));
  let converting = $state<InboxItem | null>(null);
  let draft = $state<TaskInput>(emptyTask(0));
  let planToday = $state(false);

  function openConvert(item: InboxItem) {
    converting = item;
    draft = emptyTask(defaultProjectId(openProjects), { title: item.text });
    planToday = false;
  }

  async function saveTask() {
    if (!converting || !draft.title.trim() || !draft.project_id) return;
    const projectId = draft.project_id;
    const projectName = projects.find((p) => p.id === projectId)?.name ?? "the project";
    await addTask(draft, planToday ? todayString() : null);
    await deleteInboxItem(converting.id);
    rememberProject(projectId);
    converting = null;
    await load();
    toast.success(`Task added to ${projectName}${planToday ? " and Today" : ""}`, {
      action: { label: "Open", run: () => goto(`/projects/${projectId}?tab=tasks`) },
    });
  }

  useShortcuts({ n: () => newInput?.focus() });
</script>

<PageHeader title="Inbox" subtitle="Ideas and tasks captured with {quickCaptureKeys()}, waiting to be sorted" />

<div class="page space-y-4 py-6">
  <form class="flex gap-2" onsubmit={add}>
    <input
      bind:this={newInput}
      bind:value={newText}
      class="input"
      placeholder="Add an idea or task… (N)"
      aria-label="New inbox item"
    />
    <button type="submit" class="btn btn-primary shrink-0" disabled={!newText.trim()}><Icon name="plus" size={14} />Add</button>
  </form>

  <div class="card divide-y divide-line">
    {#if !loaded}
      <Skeleton />
    {:else}
      {#each items as item (item.id)}
        <div class="group list-row">
          <p class="min-w-0 flex-1 text-sm break-words text-fg">{item.text}</p>
          <span class="shrink-0 text-xs text-faint" title={item.created_at}>{timeAgo(item.created_at)}</span>
          <button
            type="button"
            class="btn btn-secondary btn-sm shrink-0"
            onclick={() => openConvert(item)}
            disabled={openProjects.length === 0}
            title={openProjects.length === 0 ? "Create a project first" : "Move it into a project as a task"}
          >
            <Icon name="tasks" size={12} />Make task
          </button>
          <button
            type="button"
            class="icon-btn icon-btn-danger"
            aria-label="Delete {item.text}"
            title="Delete"
            onclick={() => remove(item)}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      {:else}
        <EmptyState
          icon="inbox"
          message="Inbox zero"
          hint="Press {quickCaptureKeys()} anywhere, even with the app hidden, to capture an idea. It lands here to sort later."
        />
      {/each}
    {/if}
  </div>
</div>

<Modal
  open={converting !== null}
  title="Make task"
  description="Moves this item into a project and takes it out of the Inbox."
  submitLabel="Create task"
  onclose={() => (converting = null)}
  onsubmit={saveTask}
>
  <TaskForm bind:values={draft} projects={openProjects} {milestones} />
  <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
    <input type="checkbox" class="checkbox" bind:checked={planToday} />Add to Today
  </label>
</Modal>
