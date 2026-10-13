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
  import { rememberCapture } from "$lib/quickadd.svelte";
  import { quickCaptureKeys } from "$lib/settings.svelte";
  import { useShortcuts } from "$lib/shortcuts.svelte";
  import { toast } from "$lib/toast.svelte";
  import { MISC_LABEL, type InboxItem, type Milestone, type Project, type TaskInput } from "$lib/types";

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
    rememberCapture();
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
  let draft = $state<TaskInput>(emptyTask(null));
  let planToday = $state(false);

  function openConvert(item: InboxItem) {
    converting = item;
    draft = emptyTask(defaultProjectId(openProjects), { title: item.text });
    planToday = false;
  }

  async function saveTask() {
    if (!converting || !draft.title.trim()) return;
    const projectId = draft.project_id;
    const projectName = projects.find((p) => p.id === projectId)?.name;
    await addTask(draft, planToday ? todayString() : null);
    await deleteInboxItem(converting.id);
    rememberProject(projectId);
    converting = null;
    await load();
    const where = `${projectName ?? MISC_LABEL}${planToday ? " and Today" : ""}`;
    const href = projectId !== null ? `/projects/${projectId}?tab=tasks` : "/misc";
    toast.success(`Task added to ${where}`, { action: { label: "Open", run: () => goto(href) } });
  }

  useShortcuts({ n: () => newInput?.focus() });
</script>

<PageHeader
  narrow
  title="Inbox"
  subtitle="Quick ideas land here. Turn each one into a task when you're ready, or delete it."
/>

<div class="page page-narrow space-y-4 pt-5 pb-12">
  <form
    class="flex gap-2.5 rounded-item border border-line-strong bg-surface p-2 transition-colors duration-150 focus-within:border-accent"
    onsubmit={add}
  >
    <input
      bind:this={newInput}
      bind:value={newText}
      class="h-10 min-w-0 flex-1 bg-transparent px-2.5 text-sm text-strong outline-none placeholder:text-faint"
      placeholder="Write an idea or task and press Enter"
      aria-label="New inbox item"
      title="N"
    />
    <button type="submit" class="btn btn-primary h-10 shrink-0 px-4.5 text-sm" disabled={!newText.trim()}>Add</button>
  </form>

  <div class="card divide-y divide-line">
    {#if !loaded}
      <Skeleton />
    {:else}
      {#each items as item (item.id)}
        <div class="group list-row min-h-15 py-2.5">
          <div class="min-w-0 flex-1">
            <p class="text-sm break-words text-strong">{item.text}</p>
            <p class="text-xs text-faint" title={item.created_at}>{timeAgo(item.created_at)}</p>
          </div>
          <button
            type="button"
            class="btn btn-secondary btn-sm shrink-0"
            onclick={() => openConvert(item)}
            title="Turn it into a task, in a project or in Misc"
          >
            Make task
          </button>
          <button
            type="button"
            class="icon-btn icon-btn-danger size-8.5"
            aria-label="Delete {item.text}"
            title="Delete"
            onclick={() => remove(item)}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      {:else}
        <EmptyState
          icon="inbox"
          message="Inbox is clear"
          hint="Everything has been sorted. Press {quickCaptureKeys()} anywhere, even with the app hidden, to capture an idea; it lands here."
        />
      {/each}
    {/if}
  </div>
</div>
<Modal
  open={converting !== null}
  title="Make task"
  description="Turns this item into a task and takes it out of the Inbox."
  submitLabel="Create task"
  onclose={() => (converting = null)}
  onsubmit={saveTask}
>
  <TaskForm bind:values={draft} projects={openProjects} {milestones} />
  <label class="flex cursor-pointer items-center gap-2 text-sm text-fg">
    <input type="checkbox" class="checkbox" bind:checked={planToday} />Add to Today
  </label>
</Modal>
