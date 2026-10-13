<!--
  Misc: small everyday jobs that don't belong to a project (update Windows, check a bill). They are
  tasks with no project, so the sun puts them on today's plan like any other task. A Misc task is
  just a title and a priority (no milestone, status or due date) and doesn't show in All tasks.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { flip } from "svelte/animate";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import TaskForm, { emptyTask, rememberProject } from "$lib/components/TaskForm.svelte";
  import TaskRow from "$lib/components/TaskRow.svelte";
  import { addTask, deleteTask, getMilestones, getProjects, getTasks, setTaskDone, setTaskStatus, setTasksPlanned, updateTask } from "$lib/db";
  import { todayString } from "$lib/dates";
  import { ms } from "$lib/motion";
  import { onDataChanged } from "$lib/quickadd.svelte";
  import { isArchived } from "$lib/settings.svelte";
  import { useShortcuts } from "$lib/shortcuts.svelte";
  import { toast } from "$lib/toast.svelte";
  import type { Milestone, Priority, Project, Task, TaskInput } from "$lib/types";

  let tasks = $state<Task[]>([]);
  let projects = $state<Project[]>([]);
  let milestones = $state<Milestone[]>([]);
  let loaded = $state(false);
  let showDone = $state(false);

  async function load() {
    const [t, p, m] = await Promise.all([getTasks(), getProjects(), getMilestones()]);
    tasks = t.filter((task) => task.project_id === null);
    // For moving a task into a project from the edit dialog.
    projects = p.filter((project) => project.status !== "completed" && !isArchived(project));
    milestones = m;
    loaded = true;
  }

  onMount(load);
  onDataChanged(load);

  const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

  // Higher priority first, then oldest first.
  let open = $derived(tasks.filter((t) => !t.is_done).sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.id - b.id));
  let done = $derived(tasks.filter((t) => t.is_done).sort((a, b) => b.id - a.id));

  // ----- Add -----
  let newText = $state("");
  let newInput = $state<HTMLInputElement>();

  async function add(event: SubmitEvent) {
    event.preventDefault();
    if (!newText.trim()) return;
    await addTask(emptyTask(null, { title: newText }));
    newText = "";
    await load();
  }

  // ----- Row actions -----
  async function toggle(t: Task) {
    await setTaskDone(t.id, !t.is_done);
    await load();
    // Finished tasks go into the folded Done list, so say where it went and offer Undo.
    if (!t.is_done && !showDone) {
      toast.undo("Task completed", async () => {
        await setTaskStatus(t.id, t.status);
        await load();
      });
    }
  }

  async function togglePlanned(t: Task) {
    const planned = t.planned_for === todayString();
    await setTasksPlanned([t.id], planned ? null : todayString());
    await load();
    toast.success(planned ? "Removed from Today" : "Added to Today");
  }

  async function remove(t: Task) {
    const undo = await deleteTask(t.id);
    await load();
    toast.undo("Task deleted", async () => {
      await undo();
      await load();
    });
  }

  // ----- Edit (also moves a task into a project) -----
  let editingId = $state<number | null>(null);
  let draft = $state<TaskInput>(emptyTask(null));

  function openEdit(t: Task) {
    editingId = t.id;
    draft = { project_id: t.project_id, milestone_id: t.milestone_id, title: t.title, priority: t.priority, due_date: t.due_date, status: t.status };
  }

  async function saveEdit() {
    if (editingId === null || !draft.title.trim()) return;
    await updateTask(editingId, draft);
    editingId = null;
    const project = projects.find((p) => p.id === draft.project_id);
    if (project) rememberProject(project.id);
    toast.success(project ? `Moved to ${project.name}` : "Task saved");
    await load();
  }

  function deleteEditing() {
    const t = tasks.find((x) => x.id === editingId);
    editingId = null;
    if (t) remove(t);
  }

  useShortcuts({ n: () => newInput?.focus() });
</script>

<PageHeader
  narrow
  title="Misc"
  subtitle="Small everyday jobs that don't need a project. Use the sun to add one to today's plan."
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
      placeholder="Add a task and press Enter"
      aria-label="New Misc task"
      title="N"
    />
    <button type="submit" class="btn btn-primary h-10 shrink-0 px-4.5 text-sm" disabled={!newText.trim()}>Add</button>
  </form>

  <div class="card divide-y divide-line">
    {#if !loaded}
      <Skeleton />
    {:else}
      {#each open as task (task.id)}
        <div animate:flip={{ duration: ms(200) }}>
          <TaskRow {task} ontoggle={toggle} onedit={openEdit} ondelete={remove} onplan={togglePlanned} />
        </div>
      {:else}
        <EmptyState
          icon="shapes"
          message={done.length > 0 ? "All done" : "Nothing here yet"}
          hint="Small things like updating Windows, installing an app or checking a bill."
        />
      {/each}
    {/if}
  </div>

  {#if done.length > 0}
    <section class="card">
      <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-2 px-5 py-3.5 text-left text-sm font-semibold text-muted transition-colors duration-150 hover:text-strong"
        aria-expanded={showDone}
        onclick={() => (showDone = !showDone)}
      >
        <Icon name={showDone ? "up" : "down"} size={16} />Done <span class="count">{done.length}</span>
      </button>
      {#if showDone}
        <div class="divide-y divide-line border-t border-line">
          {#each done as task (task.id)}
            <div animate:flip={{ duration: ms(200) }}>
              <TaskRow {task} ontoggle={toggle} onedit={openEdit} ondelete={remove} />
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

<Modal open={editingId !== null} title="Edit task" onclose={() => (editingId = null)} onsubmit={saveEdit} ondelete={deleteEditing}>
  <TaskForm bind:values={draft} {projects} {milestones} />
</Modal>
