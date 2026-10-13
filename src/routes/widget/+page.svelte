<!--
  The Today widget: today's plan in its own small window on the desktop (shown and placed by
  src-tauri/src/lib.rs, which also keeps it on top or behind other windows). Check tasks off, add
  one for today (↑ / ↓ pick the project, like quick capture), or click a task to open it in the app.
  It follows changes made in any window through db-changed (db.ts).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import { CheckMenuItem, Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import DeadlineLabel from "$lib/components/DeadlineLabel.svelte";
  import EmptyState from "$lib/components/EmptyState.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import ProgressRing from "$lib/components/ProgressRing.svelte";
  import ProjectDot from "$lib/components/ProjectDot.svelte";
  import Skeleton from "$lib/components/Skeleton.svelte";
  import { defaultProjectId, emptyTask, rememberProject } from "$lib/components/TaskForm.svelte";
  import { formatWeekdayDate, todayString } from "$lib/dates";
  import { addTask, DB_CHANGED, getProjects, getTasks, setTaskDone } from "$lib/db";
  import { notifyDataChangedEverywhere, projectChoices, projectStep, stepIn } from "$lib/quickadd.svelte";
  import { isArchived, setWidgetOnTop, setWidgetShown, settings } from "$lib/settings.svelte";
  import { openInMain } from "$lib/system";
  import { byTodayOrder, MISC_COLOR, MISC_LABEL, type Project, type Task } from "$lib/types";

  const appWindow = getCurrentWindow();

  /** How long after the last move or resize the position is saved. */
  const SAVE_PLACE_MS = 800;

  let tasks = $state<Task[]>([]);
  let projects = $state<Project[]>([]);
  let loaded = $state(false);
  let today = $state(todayString());
  /** The last failed action (cleared by the next one that works). */
  let error = $state("");
  /** Loading failed (cleared by the next load that works, e.g. after a restore). */
  let loadError = $state("");

  let todayTasks = $derived(tasks.filter((t) => t.planned_for === today).sort(byTodayOrder));
  let doneCount = $derived(todayTasks.filter((t) => t.is_done).length);
  let progress = $derived(
    !loaded
      ? " "
      : todayTasks.length === 0
        ? "Nothing planned yet"
        : doneCount === todayTasks.length
          ? "All done for today"
          : `${doneCount} of ${todayTasks.length} done`
  );

  async function load() {
    try {
      today = todayString();
      const [t, p] = await Promise.all([getTasks(), getProjects()]);
      tasks = t;
      // The add field offers the same projects as quick capture: not completed, not archived.
      projects = p.filter((x) => x.status !== "completed" && !isArchived(x));
      if (!loaded) projectId = defaultProjectId(projects);
      else if (projectId !== null && !projects.some((x) => x.id === projectId)) projectId = null;
      loaded = true;
      loadError = "";
    } catch (e) {
      loadError = `Couldn't load today's plan: ${e}`;
    }
  }

  /** The app may run overnight: a new day starts a new list. A failed load is tried again too. */
  function checkDay() {
    if (todayString() !== today || loadError) load();
  }

  let saveTimer: ReturnType<typeof setTimeout> | undefined;

  /** Saves where the widget is a moment after it stops moving (Windows sends a stream of moves). */
  function savePlaceSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => invoke("save_widget_state").catch((e) => console.error("Widget position:", e)), SAVE_PLACE_MS);
  }

  onMount(() => {
    load();
    const timer = setInterval(checkDay, 60_000);
    const stops = [listen(DB_CHANGED, load), appWindow.onMoved(savePlaceSoon), appWindow.onResized(savePlaceSoon)];
    return () => {
      clearInterval(timer);
      clearTimeout(saveTimer);
      stops.forEach((stop) => stop.then((fn) => fn()));
    };
  });

  /** Runs an action and shows what went wrong in the bar at the bottom (this window has no toasts). */
  async function attempt(action: () => Promise<unknown>) {
    try {
      await action();
      error = "";
    } catch (e) {
      error = String(e);
    }
  }

  /** Runs a change, then reloads here and tells the main window's page to reload too. */
  function change(action: () => Promise<void>) {
    return attempt(async () => {
      await action();
      await load();
      await notifyDataChangedEverywhere();
    });
  }

  function toggle(task: Task) {
    return change(() => setTaskDone(task.id, !task.is_done));
  }

  function openTask(task: Task) {
    attempt(() => openInMain(task.project_id === null ? "/misc" : `/projects/${task.project_id}?tab=tasks`));
  }

  // ----- Header: drag to move, ⋯ for the menu -----

  function onheaderdown(event: MouseEvent) {
    if (event.button !== 0 || (event.target as Element).closest("button")) return;
    appWindow.startDragging();
  }

  /** Built on first use and then reused: each native menu lives in Rust until it's closed. */
  let menu: Promise<{ menu: Menu; onTop: CheckMenuItem }> | undefined;

  async function buildMenu() {
    const onTop = await CheckMenuItem.new({
      text: "Keep on top",
      checked: settings.widget_on_top,
      action: () => attempt(() => setWidgetOnTop(!settings.widget_on_top)),
    });
    const items = [
      onTop,
      await PredefinedMenuItem.new({ item: "Separator" }),
      await MenuItem.new({ text: "Open MilestoneSpace", action: () => attempt(() => openInMain("/")) }),
      await MenuItem.new({ text: "Plan my day…", action: () => attempt(() => openInMain("/?plan=1")) }),
      await PredefinedMenuItem.new({ item: "Separator" }),
      await MenuItem.new({ text: "Hide widget", action: () => attempt(() => setWidgetShown(false)) }),
    ];
    return { menu: await Menu.new({ items }), onTop };
  }

  function openMenu() {
    return attempt(async () => {
      menu ??= buildMenu();
      const built = await menu.catch((e) => {
        menu = undefined; // try again next time
        throw e;
      });
      // Keep on top may have been changed in Settings since.
      await built.onTop.setChecked(settings.widget_on_top);
      await built.menu.popup();
    });
  }

  // ----- Add a task for today -----

  let text = $state("");
  /** The new task's project (null: Misc). */
  let projectId = $state<number | null>(null);
  let project = $derived(projects.find((p) => p.id === projectId));
  let projectIds = $derived(projectChoices("today", projects));
  let saving = false;

  async function add(event: SubmitEvent) {
    event.preventDefault();
    const title = text.trim();
    if (!title || saving) return;
    saving = true;
    await change(async () => {
      // Not `today`: just after midnight it may not have caught up with the new day yet.
      await addTask(emptyTask(projectId, { title }), todayString());
      rememberProject(projectId);
      text = "";
    });
    saving = false;
  }

  function oninputkeydown(event: KeyboardEvent) {
    const step = projectStep(event);
    if (step) projectId = stepIn(projectIds, projectId, step);
  }

  // Finished tasks step back until the row is hovered or focused, as in the app.
  const dim = "opacity-50 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100";
</script>

<svelte:window onfocus={checkDay} />

<div class="flex h-screen flex-col overflow-hidden border border-line-strong bg-surface">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <header class="flex shrink-0 items-center gap-3 border-b border-line bg-chrome py-2.5 pr-2 pl-3.5 select-none" onmousedown={onheaderdown}>
    <ProgressRing done={doneCount} total={todayTasks.length} size={30} />
    <div class="min-w-0 flex-1">
      <h1 class="truncate text-ui font-semibold text-strong">
        Today <span class="font-normal text-faint">· {formatWeekdayDate(today)}</span>
      </h1>
      <p class="truncate text-xs text-muted">{progress}</p>
    </div>
    <button type="button" class="icon-btn size-8" aria-label="Widget menu" title="Options" onclick={openMenu}>
      <Icon name="more" size={17} />
    </button>
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto">
    {#if !loaded}
      <Skeleton rows={3} />
    {:else if todayTasks.length > 0}
      <ul class="divide-y divide-line">
        {#each todayTasks as task (task.id)}
          <li class="group flex items-center gap-2.5 px-3.5 py-2 transition-colors duration-150 hover:bg-hover">
            <input
              type="checkbox"
              class="check-round {task.is_done ? dim : ''}"
              checked={task.is_done}
              onchange={() => toggle(task)}
              aria-label="Mark {task.title} as done"
            />
            <button
              type="button"
              class="min-w-0 flex-1 cursor-pointer rounded-control text-left {task.is_done ? dim : ''}"
              title="Open in MilestoneSpace"
              onclick={() => openTask(task)}
            >
              <span class="block truncate text-sm {task.is_done ? 'text-faint line-through' : 'text-fg'}">{task.title}</span>
              <span class="flex items-center gap-1.5 truncate text-xs text-faint">
                <ProjectDot color={task.project_color ?? MISC_COLOR} /><span class="truncate">{task.project_name ?? MISC_LABEL}</span>
              </span>
            </button>
            {#if !task.is_done}<span class="shrink-0"><DeadlineLabel date={task.due_date} /></span>{/if}
          </li>
        {/each}
      </ul>
    {:else}
      <EmptyState
        compact
        message="Nothing planned yet"
        hint="Add a task below, or pick a few from your projects."
        action={{ label: "Plan my day", icon: "sun", onclick: () => attempt(() => openInMain("/?plan=1")) }}
      />
    {/if}
  </div>

  {#if error || loadError}
    <p class="truncate border-t border-line bg-chrome px-3.5 py-1.5 text-xs text-danger" title={error || loadError}>{error || loadError}</p>
  {/if}
  <form class="flex shrink-0 items-center gap-2 border-t border-line bg-chrome py-2 pr-2 pl-3.5 focus-within:border-t-accent" onsubmit={add}>
    <span class="text-faint"><Icon name="plus" size={15} /></span>
    <input
      bind:value={text}
      class="min-w-0 flex-1 bg-transparent py-1 text-sm text-strong outline-none placeholder:text-faint"
      placeholder="Add to today…"
      aria-label="Task for today"
      autocomplete="off"
      spellcheck="false"
      onkeydown={oninputkeydown}
    />
    <button
      type="button"
      class="chip chip-on flex max-w-32 shrink-0 items-center gap-1.5"
      title="Project (↑ / ↓ in the field to change)"
      aria-live="polite"
      onclick={() => (projectId = stepIn(projectIds, projectId, 1))}
    >
      {#if project}
        <ProjectDot color={project.color} /><span class="truncate">{project.name}</span>
      {:else}
        <Icon name="shapes" size={13} />{MISC_LABEL}
      {/if}
    </button>
  </form>
</div>
