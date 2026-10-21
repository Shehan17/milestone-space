<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { getVersion } from "@tauri-apps/api/app";
  import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import Icon, { type IconName } from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ShortcutList from "$lib/components/ShortcutList.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import DataSettings from "$lib/components/settings/DataSettings.svelte";
  import HotkeyRecorder from "$lib/components/settings/HotkeyRecorder.svelte";
  import SettingRow from "$lib/components/settings/SettingRow.svelte";
  import SettingsCard from "$lib/components/settings/SettingsCard.svelte";
  import TemplateManager from "$lib/components/settings/TemplateManager.svelte";
  import TimeSelect from "$lib/components/settings/TimeSelect.svelte";
  import { appPaths } from "$lib/backup.svelte";
  import { formatDate } from "$lib/dates";
  import { inQuietHours, sendTestNotification } from "$lib/notifications";
  import {
    START_PAGES,
    saveSettings,
    setWidgetOnTop,
    setWidgetShown,
    settings,
    type DateFormat,
    type Density,
    type DoneToggleSide,
    type FontSize,
    type TimeFormat,
    type WeekStart,
  } from "$lib/settings.svelte";
  import { ACCENTS, THEMES, applyAppearance, getTheme, setTheme, type Theme, type ThemeId } from "$lib/theme";
  import { toast } from "$lib/toast.svelte";
  import { PRIORITIES, PRIORITY_LABELS, PROJECT_TYPES, TYPE_LABELS } from "$lib/types";

  const isDev = import.meta.env.DEV;
  const GITHUB_URL = "https://github.com/Shehan17/milestone-space";

  // Every change is saved right away. (Settings changed elsewhere, like the last backup time,
  // are already saved; saving them again is harmless.)
  let saved = JSON.stringify(settings);
  $effect(() => {
    const current = JSON.stringify(settings);
    if (current === saved) return;
    saved = current;
    saveSettings();
  });

  // ----- General -----

  // Start with Windows. Only the installed app can register itself: in dev it would register
  // the debug build. The installed app turns it on the first time it runs (src-tauri/src/lib.rs).
  let autostart = $state(false);
  let version = $state("");
  let databasePath = $state("");

  onMount(async () => {
    if (!isDev) autostart = await isEnabled();
    version = await getVersion();
    databasePath = (await appPaths()).database;
  });

  async function toggleAutostart() {
    try {
      if (autostart) await disable();
      else await enable();
    } catch (e) {
      toast.error("Couldn't change Start with Windows", e);
    }
    autostart = await isEnabled();
  }


  // ----- Appearance -----

  let currentTheme = $state<ThemeId>(getTheme());
  let themeMode = $derived(THEMES.find((t) => t.id === currentTheme)?.mode ?? "dark");

  function chooseTheme(id: ThemeId) {
    currentTheme = id;
    setTheme(id);
    applyAppearance(settings); // the accent has light and dark shades
  }


  const densityOptions: { value: Density; label: string }[] = [
    { value: "compact", label: "Compact" },
    { value: "comfortable", label: "Comfortable" },
  ];
  const doneToggleOptions: { value: DoneToggleSide; label: string }[] = [
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
  ];
  const fontSizeOptions: { value: FontSize; label: string }[] = [
    { value: "small", label: "Small" },
    { value: "default", label: "Default" },
    { value: "large", label: "Large" },
    { value: "larger", label: "Larger" },
  ];
  // Examples use a date next year, so the worded formats show the year too.
  const DATE_FORMATS: DateFormat[] = ["d MMM yyyy", "MMM d, yyyy", "dd/MM/yyyy", "MM/dd/yyyy", "yyyy-MM-dd"];
  const EXAMPLE_DATE = `${new Date().getFullYear() + 1}-12-25`;
  const timeOptions: { value: TimeFormat; label: string }[] = [
    { value: "12h", label: "12-hour (9:00 PM)" },
    { value: "24h", label: "24-hour (21:00)" },
  ];
  const weekOptions: { value: WeekStart; label: string }[] = [
    { value: "monday", label: "Monday" },
    { value: "sunday", label: "Sunday" },
  ];

  // ----- Notifications -----

  const REMINDER_OPTIONS = [
    { days: 0, label: "On the day" },
    { days: 1, label: "1 day before" },
    { days: 3, label: "3 days before" },
  ];

  function toggleReminder(days: number) {
    settings.reminder_days = settings.reminder_days.includes(days)
      ? settings.reminder_days.filter((d) => d !== days)
      : [...settings.reminder_days, days].sort((a, b) => a - b);
  }

  let testError = $state("");

  async function testNotification() {
    testError = "";
    try {
      await sendTestNotification();
      toast.success("Test notification sent", { detail: "It should appear in the corner of your screen." });
    } catch (e) {
      testError = String(e);
    }
  }

  // ----- Projects and tasks -----

  const typeOptions = PROJECT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }));
  const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p] }));
  const completedOptions = [
    { value: "show" as const, label: "Keep in the list" },
    { value: "archive" as const, label: "Move to Archive" },
  ];

  // ----- Sections: one shown at a time, picked in the side list. In the address
  // (?section=data) so a link can open one, like the project page's tabs. -----

  type SectionId = "general" | "appearance" | "datetime" | "notifications" | "shortcuts" | "projects" | "templates" | "data" | "about";

  const SECTIONS: { id: SectionId; label: string; icon: IconName; description: string }[] = [
    { id: "general", label: "General", icon: "settings", description: "Your name, the start page, and how MilestoneSpace starts and closes." },
    { id: "appearance", label: "Appearance", icon: "palette", description: "Theme, accent color, text size, spacing, the done toggle and page descriptions." },
    { id: "datetime", label: "Date and time", icon: "calendar", description: "How dates and times are shown, the title bar clock, and when the week starts." },
    {
      id: "notifications",
      label: "Notifications",
      icon: "bell",
      description: "Windows notifications about deadlines of open tasks, milestones and projects.",
    },
    { id: "shortcuts", label: "Shortcuts", icon: "keyboard", description: "Quick capture from any app, and every keyboard shortcut." },
    {
      id: "projects",
      label: "Projects and tasks",
      icon: "projects",
      description: "Defaults for new projects and tasks, and where completed projects go.",
    },
    { id: "templates", label: "Templates", icon: "template", description: "Start new projects with milestones and tasks already in place." },
    { id: "data", label: "Data and backup", icon: "database", description: "Everything is stored on this computer. Keep a copy somewhere else." },
    { id: "about", label: "About", icon: "info", description: "Version, database location and source code." },
  ];

  const isSection = (value: unknown): value is SectionId => SECTIONS.some((s) => s.id === value);

  function sectionFromUrl(): SectionId | null {
    const value = page.url.searchParams.get("section");
    return isSection(value) ? value : null;
  }

  let section = $state<SectionId>(sectionFromUrl() ?? "general");
  let current = $derived(SECTIONS.find((s) => s.id === section) ?? SECTIONS[0]);

  // A link to another section while Settings is open switches to it.
  $effect(() => {
    const fromUrl = sectionFromUrl();
    if (fromUrl && untrack(() => section) !== fromUrl) section = fromUrl;
  });

  let tabs = $state<HTMLButtonElement[]>([]);

  function selectSection(id: SectionId) {
    if (id === section) return;
    section = id;
    document.querySelector("main")?.scrollTo({ top: 0 });
    const url = new URL(page.url);
    url.searchParams.set("section", id);
    replaceState(url, {});
  }

  // ↑/↓ (← /→ when the list is a row in narrow windows), Home and End move between sections.
  function onTabKeydown(event: KeyboardEvent, index: number) {
    const last = SECTIONS.length - 1;
    const next =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? (index + 1) % SECTIONS.length
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? (index + last) % SECTIONS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    selectSection(SECTIONS[next].id);
    tabs[next]?.focus();
  }
</script>

<!-- A miniature of the app drawn in the theme's own colors, so it previews correctly from any theme. -->
{#snippet preview(theme: Theme)}
  {@const c = theme.preview}
  <span class="flex h-18 flex-col gap-1.5 rounded-control p-2.5" style="background: {c.bg}">
    <span class="h-2.5 w-3/5 rounded-[3px]" style="background: {c.text}"></span>
    <span class="flex flex-1 items-end rounded-[5px] p-1.25" style="background: {c.card}">
      <span class="h-2 w-8.5 rounded-[3px]" style="background: {c.accent}"></span>
    </span>
  </span>
{/snippet}

{#snippet swatch(color: string, selected: boolean, label: string, onclick: () => void)}
  <button
    type="button"
    class="size-6 cursor-pointer rounded-full ring-offset-2 ring-offset-surface transition-shadow duration-150 {selected
      ? 'ring-2 ring-strong'
      : 'hover:ring-2 hover:ring-line-strong'}"
    style="background-color: {color}"
    aria-label={label}
    aria-pressed={selected}
    title={label}
    {onclick}
  ></button>
{/snippet}

<PageHeader title="Settings" subtitle="Changes apply right away." />

<div class="page flex flex-col gap-6 pt-5 pb-12 lg:flex-row lg:gap-8">
  <div
    class="-mx-1 flex shrink-0 gap-1 overflow-x-auto px-1 pb-1 lg:sticky lg:top-6 lg:mx-0 lg:w-48 lg:flex-col lg:self-start lg:overflow-visible lg:px-0 lg:pb-0"
    role="tablist"
    aria-label="Settings sections"
  >
    {#each SECTIONS as item, i (item.id)}
      {@const selected = section === item.id}
      <button
        bind:this={tabs[i]}
        id="settings-tab-{item.id}"
        type="button"
        role="tab"
        aria-selected={selected}
        aria-controls="settings-panel"
        tabindex={selected ? 0 : -1}
        class="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-control px-3 py-2 text-left text-ui whitespace-nowrap transition-colors duration-150 {selected
          ? 'bg-selected font-medium text-strong'
          : 'text-muted hover:bg-hover hover:text-strong'}"
        onclick={() => selectSection(item.id)}
        onkeydown={(e) => onTabKeydown(e, i)}
      >
        <span class={selected ? "text-accent-text" : ""}><Icon name={item.icon} size={16} /></span>
        {item.label}
      </button>
    {/each}
  </div>

  <div id="settings-panel" class="max-w-3xl min-w-0 flex-1" role="tabpanel" aria-labelledby="settings-tab-{section}">
    <header class="mb-4">
      <h2 class="text-lg font-semibold text-strong">{current.label}</h2>
      <p class="mt-0.5 text-ui text-muted">{current.description}</p>
    </header>

    <div class="space-y-5">
      {#if section === "general"}
        <SettingsCard>
          <SettingRow label="Your name" description="Used in the greeting on the Today page.">
            <input
              class="input input-sm w-44"
              value={settings.display_name}
              onchange={(e) => (settings.display_name = e.currentTarget.value.trim())}
              placeholder="Optional"
              aria-label="Your name"
              autocomplete="off"
            />
          </SettingRow>
          <SettingRow label="Start page" description="The page that opens first.">
            <select class="input input-sm w-36" bind:value={settings.start_page} aria-label="Start page">
              {#each START_PAGES as startPage (startPage.value)}
                <option value={startPage.value}>{startPage.label}</option>
              {/each}
            </select>
          </SettingRow>
        </SettingsCard>

        <SettingsCard title="Startup and closing">
          <SettingRow
            label="Start with Windows"
            description={isDev
              ? "Only available in the installed app."
              : "Starts when you log in, so quick capture and reminders are always ready."}
            toggle
            disabled={isDev}
          >
            <input type="checkbox" class="switch" checked={autostart} disabled={isDev} onchange={toggleAutostart} />
          </SettingRow>
          <SettingRow
            label="Start minimized to tray"
            description="When it starts with Windows, stay in the tray instead of opening the window."
            toggle
          >
            <input type="checkbox" class="switch" bind:checked={settings.start_minimized} />
          </SettingRow>
          <SettingRow
            label="Close button minimizes to tray"
            description={settings.close_to_tray
              ? "Closing the window keeps MilestoneSpace running in the tray. Quit it from the tray icon's menu."
              : "Closing the window quits MilestoneSpace: no quick capture, reminders or automatic backups until you open it again."}
            toggle
          >
            <input type="checkbox" class="switch" bind:checked={settings.close_to_tray} />
          </SettingRow>
        </SettingsCard>

        <SettingsCard title="Today widget">
          <SettingRow
            label="Show the widget"
            description="A small window with today's plan on your desktop. Check off tasks and add new ones without opening the app."
            toggle
          >
            <input
              type="checkbox"
              class="switch"
              checked={settings.show_widget}
              onchange={(e) => setWidgetShown(e.currentTarget.checked)}
            />
          </SettingRow>
          <SettingRow
            label="Keep the widget on top"
            description={settings.widget_on_top
              ? "The widget stays above other windows."
              : "The widget sits on the desktop, behind other windows."}
            toggle
            disabled={!settings.show_widget}
          >
            <input
              type="checkbox"
              class="switch"
              checked={settings.widget_on_top}
              disabled={!settings.show_widget}
              onchange={(e) => setWidgetOnTop(e.currentTarget.checked)}
            />
          </SettingRow>
        </SettingsCard>
      {:else if section === "appearance"}
        <SettingsCard title="Theme" description="Saved on this computer.">
          <div class="grid grid-cols-[repeat(auto-fill,minmax(8.75rem,1fr))] gap-3 p-5">
            {#each THEMES as theme (theme.id)}
              {@const selected = currentTheme === theme.id}
              <button
                type="button"
                class="flex cursor-pointer flex-col gap-2.5 rounded-item border-2 bg-chrome p-2 pb-3 text-left transition-colors duration-150 {selected
                  ? 'border-accent'
                  : 'border-line hover:border-line-strong'}"
                aria-pressed={selected}
                title={theme.description}
                onclick={() => chooseTheme(theme.id)}
              >
                {@render preview(theme)}
                <span class="flex items-start gap-2 px-1">
                  <span class="min-w-0 flex-1">
                    <span class="block text-ui font-semibold text-strong">{theme.name}</span>
                    <span class="block text-2xs text-faint">
                      {theme.mode === "dark" ? "Dark" : "Light"}{theme.id === "aurora" ? " · new" : ""}
                    </span>
                  </span>
                  {#if selected}<span class="mt-0.5 text-accent-text"><Icon name="check" size={15} /></span>{/if}
                </span>
              </button>
            {/each}
          </div>
          <SettingRow
            label="Accent color"
            description={settings.accent === "theme"
              ? "Theme default: each theme's own accent."
              : `${ACCENTS.find((a) => a.id === settings.accent)?.name}, in every theme.`}
          >
            {@render swatch(
              THEMES.find((t) => t.id === currentTheme)?.preview.accent ?? "",
              settings.accent === "theme",
              "Theme default",
              () => (settings.accent = "theme")
            )}
            <span class="mx-1 h-4 w-px bg-line"></span>
            {#each ACCENTS as accent (accent.id)}
              {@render swatch(accent[themeMode][3], settings.accent === accent.id, accent.name, () => (settings.accent = accent.id))}
            {/each}
          </SettingRow>
        </SettingsCard>

        <SettingsCard title="Text and layout">
          <SettingRow label="Text size">
            <Tabs options={fontSizeOptions} bind:value={settings.font_size} label="Text size" />
          </SettingRow>
          <SettingRow label="Spacing" description="Comfortable adds more room around rows and buttons.">
            <Tabs options={densityOptions} bind:value={settings.density} label="Spacing" />
          </SettingRow>
          <SettingRow label="Done toggle" description="Which end of a task row the round button that marks it done sits at, here and in the Today widget.">
            <Tabs options={doneToggleOptions} bind:value={settings.done_toggle_side} label="Done toggle" />
          </SettingRow>
          <SettingRow label="Page descriptions" description="The line under each page title, including the summary on the Today page." toggle>
            <input type="checkbox" class="switch" bind:checked={settings.page_descriptions} />
          </SettingRow>
        </SettingsCard>
      {:else if section === "datetime"}
        <SettingsCard>
          <SettingRow label="Date and time in the title bar" description="Shown in the middle of the bar at the top of the window." toggle>
            <input type="checkbox" class="switch" bind:checked={settings.title_bar_clock} />
          </SettingRow>
          <SettingRow label="Date format" description="Dates in this year leave out the year in the worded formats.">
            <select class="input input-sm w-44" bind:value={settings.date_format} aria-label="Date format">
              {#each DATE_FORMATS as format (format)}
                <option value={format}>{formatDate(EXAMPLE_DATE, format)}</option>
              {/each}
            </select>
          </SettingRow>
          <SettingRow label="Time format">
            <Tabs options={timeOptions} bind:value={settings.time_format} label="Time format" />
          </SettingRow>
          <SettingRow label="Week starts on" description="Used for “This week” on the Today page and “Next week” in date fields.">
            <Tabs options={weekOptions} bind:value={settings.week_start} label="Week starts on" />
          </SettingRow>
        </SettingsCard>
      {:else if section === "notifications"}
        <SettingsCard>
          <SettingRow label="Notifications" description="Turn all reminders and the daily summary on or off." toggle>
            <input type="checkbox" class="switch" bind:checked={settings.notifications} />
          </SettingRow>
          <SettingRow label="Test" description={testError || "Shows today's summary now, to check that notifications appear."}>
            <button type="button" class="btn btn-secondary" onclick={testNotification}>Send a test</button>
          </SettingRow>
        </SettingsCard>

        <SettingsCard title="Reminders and summary">
          <SettingRow label="Deadline reminders" description="When to remind you before something is due." disabled={!settings.notifications}>
            {#each REMINDER_OPTIONS as option (option.days)}
              <label class="flex cursor-pointer items-center gap-1.5 text-xs text-fg">
                <input
                  type="checkbox"
                  class="checkbox"
                  checked={settings.reminder_days.includes(option.days)}
                  disabled={!settings.notifications}
                  onchange={() => toggleReminder(option.days)}
                />
                {option.label}
              </label>
            {/each}
          </SettingRow>
          <SettingRow
            label="Daily summary"
            description="What's due today, what's overdue, and your Today list, e.g. “3 deadlines today · 1 overdue”."
            toggle
            disabled={!settings.notifications}
          >
            <input type="checkbox" class="switch" bind:checked={settings.daily_summary} disabled={!settings.notifications} />
          </SettingRow>
          <SettingRow
            label="Notification time"
            description="When the day's summary and reminders come. If MilestoneSpace isn't running then, they come when it starts."
            disabled={!settings.notifications}
          >
            <TimeSelect bind:value={settings.notify_time} label="Notification time" disabled={!settings.notifications} />
          </SettingRow>
          <SettingRow
            label="Quiet hours"
            description={settings.quiet_hours && inQuietHours()
              ? "No notifications during these hours. It's quiet hours now."
              : "No notifications during these hours."}
            disabled={!settings.notifications}
          >
            <input
              type="checkbox"
              class="switch"
              bind:checked={settings.quiet_hours}
              disabled={!settings.notifications}
              aria-label="Quiet hours"
            />
            <TimeSelect bind:value={settings.quiet_start} label="Quiet from" disabled={!settings.notifications || !settings.quiet_hours} />
            <span class="text-xs text-faint">to</span>
            <TimeSelect bind:value={settings.quiet_end} label="Quiet until" disabled={!settings.notifications || !settings.quiet_hours} />
          </SettingRow>
        </SettingsCard>
      {:else if section === "shortcuts"}
        <SettingsCard>
          <SettingRow label="Quick capture" description="Opens a small box from any app. What you type goes to the Inbox.">
            <HotkeyRecorder />
          </SettingRow>
        </SettingsCard>

        <SettingsCard title="All keyboard shortcuts">
          <div class="p-5">
            <ShortcutList columns />
          </div>
        </SettingsCard>
      {:else if section === "projects"}
        <SettingsCard>
          <SettingRow label="Default project type" description="For new projects.">
            <Tabs options={typeOptions} bind:value={settings.default_project_type} label="Default project type" />
          </SettingRow>
          <SettingRow label="Default task priority" description="For new tasks.">
            <Tabs options={priorityOptions} bind:value={settings.default_priority} label="Default task priority" />
          </SettingRow>
          <SettingRow
            label="Completed projects"
            description={settings.completed_projects === "archive"
              ? "Hidden from lists, tasks and Today. Find them under Projects → Archive."
              : "Stay in the project list with the others."}
          >
            <Tabs options={completedOptions} bind:value={settings.completed_projects} label="Completed projects" />
          </SettingRow>
        </SettingsCard>
      {:else if section === "templates"}
        <SettingsCard>
          <div class="p-5">
            <TemplateManager />
          </div>
        </SettingsCard>
      {:else if section === "data"}
        <DataSettings />
      {:else if section === "about"}
        <SettingsCard>
          <SettingRow label="MilestoneSpace" description="Your own workspace for projects, milestones, tasks and deadlines.">
            <span class="text-xs text-muted tabular-nums">Version {version}{isDev ? " (development build)" : ""}</span>
          </SettingRow>
          <SettingRow label="Database">
            {#snippet below()}
              <p class="input input-sm truncate text-muted select-all" title={databasePath}>{databasePath}</p>
            {/snippet}
          </SettingRow>
          <SettingRow label="Source code" description="github.com/Shehan17/milestone-space">
            <button type="button" class="btn btn-secondary" onclick={() => openUrl(GITHUB_URL)}>
              <Icon name="github" size={14} />Open on GitHub
            </button>
          </SettingRow>
        </SettingsCard>
      {/if}
    </div>
  </div>
</div>

