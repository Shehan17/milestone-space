<script lang="ts">
  import { onMount } from "svelte";
  import { getVersion } from "@tauri-apps/api/app";
  import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import Icon from "$lib/components/Icon.svelte";
  import PageHeader from "$lib/components/PageHeader.svelte";
  import ShortcutList from "$lib/components/ShortcutList.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import DataSettings from "$lib/components/settings/DataSettings.svelte";
  import HotkeyRecorder from "$lib/components/settings/HotkeyRecorder.svelte";
  import SettingRow from "$lib/components/settings/SettingRow.svelte";
  import SettingsSection from "$lib/components/settings/SettingsSection.svelte";
  import TemplateManager from "$lib/components/settings/TemplateManager.svelte";
  import TimeSelect from "$lib/components/settings/TimeSelect.svelte";
  import { appPaths } from "$lib/backup.svelte";
  import { formatDate } from "$lib/dates";
  import { inQuietHours, sendTestNotification } from "$lib/notifications";
  import {
    saveSettings,
    settings,
    type DateFormat,
    type Density,
    type FontSize,
    type StartPage,
    type TimeFormat,
    type WeekStart,
  } from "$lib/settings.svelte";
  import { ACCENTS, THEMES, applyAppearance, getTheme, setTheme, type Theme, type ThemeId } from "$lib/theme";
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
    if (autostart) await disable();
    else await enable();
    autostart = await isEnabled();
  }

  const START_PAGES: { value: StartPage; label: string }[] = [
    { value: "/", label: "Today" },
    { value: "/dashboard", label: "Dashboard" },
    { value: "/inbox", label: "Inbox" },
    { value: "/projects", label: "Projects" },
    { value: "/tasks", label: "Tasks" },
  ];

  // ----- Appearance -----

  let currentTheme = $state<ThemeId>(getTheme());
  let themeMode = $derived(THEMES.find((t) => t.id === currentTheme)?.mode ?? "dark");

  function chooseTheme(id: ThemeId) {
    currentTheme = id;
    setTheme(id);
    applyAppearance(settings); // the accent has light and dark shades
  }

  const themeGroups = [
    { label: "Dark", themes: THEMES.filter((t) => t.mode === "dark") },
    { label: "Light", themes: THEMES.filter((t) => t.mode === "light") },
  ];

  const densityOptions: { value: Density; label: string }[] = [
    { value: "compact", label: "Compact" },
    { value: "comfortable", label: "Comfortable" },
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

  const SECTIONS = [
    { id: "general", label: "General" },
    { id: "appearance", label: "Appearance" },
    { id: "notifications", label: "Notifications" },
    { id: "shortcuts", label: "Shortcuts" },
    { id: "projects", label: "Projects and tasks" },
    { id: "data", label: "Data and backup" },
    { id: "about", label: "About" },
  ];
</script>

<!-- A miniature of the app drawn in the theme's own colors, so it previews correctly from any theme. -->
{#snippet preview(theme: Theme)}
  {@const c = theme.preview}
  <div class="flex h-24 overflow-hidden rounded-md border" style="background: {c.bg}; border-color: {c.border}">
    <div class="w-1/4 space-y-1.5 border-r p-2" style="border-color: {c.border}">
      <div class="h-1.5 w-3/4 rounded-full" style="background: {c.accent}"></div>
      <div class="h-1.5 w-full rounded-full" style="background: {c.muted}; opacity: 0.5"></div>
      <div class="h-1.5 w-2/3 rounded-full" style="background: {c.muted}; opacity: 0.5"></div>
    </div>
    <div class="flex-1 space-y-2 p-2.5">
      <div class="h-2 w-1/2 rounded-full" style="background: {c.text}"></div>
      <div class="space-y-1.5 rounded border p-2" style="background: {c.card}; border-color: {c.border}">
        <div class="h-1.5 w-5/6 rounded-full" style="background: {c.muted}"></div>
        <div class="h-1 overflow-hidden rounded-full" style="background: {c.border}">
          <div class="h-full w-3/5" style="background: {c.accent}"></div>
        </div>
      </div>
    </div>
  </div>
{/snippet}

{#snippet swatch(color: string, selected: boolean, label: string, onclick: () => void)}
  <button
    type="button"
    class="size-6 cursor-pointer rounded-full ring-offset-2 ring-offset-zinc-900 {selected
      ? 'ring-2 ring-zinc-200'
      : 'hover:ring-2 hover:ring-zinc-600'}"
    style="background-color: {color}"
    aria-label={label}
    aria-pressed={selected}
    title={label}
    {onclick}
  ></button>
{/snippet}

<PageHeader title="Settings" subtitle="Saved automatically" />

<div class="flex gap-8 px-8 py-6">
  <nav class="sticky top-6 hidden w-40 shrink-0 space-y-0.5 self-start lg:block" aria-label="Settings sections">
    {#each SECTIONS as section (section.id)}
      <a
        href="#{section.id}"
        class="block rounded-md px-2.5 py-1 text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
        onclick={(e) => {
          e.preventDefault();
          document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" });
        }}>{section.label}</a
      >
    {/each}
  </nav>

  <div class="max-w-3xl min-w-0 flex-1 space-y-6">
    <SettingsSection id="general" title="General">
      <SettingRow
        label="Start with Windows"
        description={isDev ? "Only available in the installed app." : "Starts when you log in, so quick capture and reminders are always ready."}
        toggle
        disabled={isDev}
      >
        <input type="checkbox" class="checkbox" checked={autostart} disabled={isDev} onchange={toggleAutostart} />
      </SettingRow>
      <SettingRow
        label="Start minimized to tray"
        description="When it starts with Windows, stay in the tray instead of opening the window."
        toggle
      >
        <input type="checkbox" class="checkbox" bind:checked={settings.start_minimized} />
      </SettingRow>
      <SettingRow
        label="Close button minimizes to tray"
        description={settings.close_to_tray
          ? "Closing the window keeps MilestoneSpace running in the tray. Quit it from the tray icon's menu."
          : "Closing the window quits MilestoneSpace: no quick capture, reminders or automatic backups until you open it again."}
        toggle
      >
        <input type="checkbox" class="checkbox" bind:checked={settings.close_to_tray} />
      </SettingRow>
      <SettingRow label="Start page" description="The page that opens first.">
        <select class="input w-36 py-1 text-xs" bind:value={settings.start_page} aria-label="Start page">
          {#each START_PAGES as page (page.value)}
            <option value={page.value}>{page.label}</option>
          {/each}
        </select>
      </SettingRow>
    </SettingsSection>

    <SettingsSection id="appearance" title="Appearance" description="Saved on this computer.">
      <div class="space-y-5 p-4">
        {#each themeGroups as group (group.label)}
          <div>
            <p class="mb-2 text-[11px] font-medium tracking-wide text-zinc-500 uppercase">{group.label}</p>
            <div class="grid gap-3 sm:grid-cols-2">
              {#each group.themes as theme (theme.id)}
                {@const selected = currentTheme === theme.id}
                <button
                  type="button"
                  class="cursor-pointer rounded-lg border p-2.5 text-left transition-colors {selected
                    ? 'border-violet-500 ring-1 ring-violet-500/40'
                    : 'border-zinc-800 hover:border-zinc-700'}"
                  aria-pressed={selected}
                  onclick={() => chooseTheme(theme.id)}
                >
                  {@render preview(theme)}
                  <div class="mt-2.5 flex items-center gap-2">
                    <span class="text-sm font-medium text-zinc-100">{theme.name}</span>
                    {#if selected}
                      <span class="ml-auto text-violet-400"><Icon name="check" size={14} /></span>
                    {/if}
                  </div>
                  <p class="text-xs text-zinc-500">{theme.description}</p>
                </button>
              {/each}
            </div>
          </div>
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
        <span class="mx-1 h-4 w-px bg-zinc-800"></span>
        {#each ACCENTS as accent (accent.id)}
          {@render swatch(accent[themeMode][2], settings.accent === accent.id, accent.name, () => (settings.accent = accent.id))}
        {/each}
      </SettingRow>
      <SettingRow label="Spacing" description="Comfortable adds more room around rows and buttons.">
        <Tabs options={densityOptions} bind:value={settings.density} />
      </SettingRow>
      <SettingRow label="Text size">
        <Tabs options={fontSizeOptions} bind:value={settings.font_size} />
      </SettingRow>
      <SettingRow label="Date format" description="Dates in this year leave out the year in the worded formats.">
        <select class="input w-44 py-1 text-xs" bind:value={settings.date_format} aria-label="Date format">
          {#each DATE_FORMATS as format (format)}
            <option value={format}>{formatDate(EXAMPLE_DATE, format)}</option>
          {/each}
        </select>
      </SettingRow>
      <SettingRow label="Time format">
        <Tabs options={timeOptions} bind:value={settings.time_format} />
      </SettingRow>
      <SettingRow label="Week starts on" description="Used for “Due this week” on the dashboard.">
        <Tabs options={weekOptions} bind:value={settings.week_start} />
      </SettingRow>
    </SettingsSection>

    <SettingsSection id="notifications" title="Notifications" description="Windows notifications about deadlines of open tasks, milestones and projects.">
      <SettingRow label="Notifications" description="Turn all reminders and the daily summary on or off." toggle>
        <input type="checkbox" class="checkbox" bind:checked={settings.notifications} />
      </SettingRow>
      <SettingRow label="Deadline reminders" description="When to remind you before something is due." disabled={!settings.notifications}>
        {#each REMINDER_OPTIONS as option (option.days)}
          <label class="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-300">
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
        <input type="checkbox" class="checkbox" bind:checked={settings.daily_summary} disabled={!settings.notifications} />
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
          class="checkbox"
          bind:checked={settings.quiet_hours}
          disabled={!settings.notifications}
          aria-label="Quiet hours"
        />
        <TimeSelect bind:value={settings.quiet_start} label="Quiet from" disabled={!settings.notifications || !settings.quiet_hours} />
        <span class="text-xs text-zinc-500">to</span>
        <TimeSelect bind:value={settings.quiet_end} label="Quiet until" disabled={!settings.notifications || !settings.quiet_hours} />
      </SettingRow>
      <SettingRow label="Test" description={testError || "Shows today's summary now, to check that notifications appear."}>
        <button type="button" class="btn btn-ghost border border-zinc-800" onclick={testNotification}>Send a test</button>
      </SettingRow>
    </SettingsSection>

    <SettingsSection id="shortcuts" title="Shortcuts">
      <SettingRow label="Quick capture" description="Opens a small box from any app. What you type goes to the Inbox.">
        <HotkeyRecorder />
      </SettingRow>
      <div class="p-4">
        <p class="mb-3 text-sm text-zinc-200">All keyboard shortcuts</p>
        <ShortcutList columns />
      </div>
    </SettingsSection>

    <SettingsSection id="projects" title="Projects and tasks">
      <SettingRow label="Default project type" description="For new projects.">
        <Tabs options={typeOptions} bind:value={settings.default_project_type} />
      </SettingRow>
      <SettingRow label="Default task priority" description="For new tasks.">
        <Tabs options={priorityOptions} bind:value={settings.default_priority} />
      </SettingRow>
      <SettingRow
        label="Completed projects"
        description={settings.completed_projects === "archive"
          ? "Hidden from lists, tasks and the dashboard. Find them under Projects → Archive."
          : "Stay in the project list with the others."}
      >
        <Tabs options={completedOptions} bind:value={settings.completed_projects} />
      </SettingRow>
      <SettingRow label="Project templates" description="Start new projects with milestones and tasks already in place.">
        {#snippet below()}
          <TemplateManager />
        {/snippet}
      </SettingRow>
    </SettingsSection>

    <SettingsSection id="data" title="Data and backup" description="Everything is stored on this computer. Keep a copy somewhere else.">
      <DataSettings />
    </SettingsSection>

    <SettingsSection id="about" title="About">
      <SettingRow label="MilestoneSpace" description="Your own workspace for projects, milestones, tasks and deadlines.">
        <span class="text-xs text-zinc-400 tabular-nums">Version {version}{isDev ? " (development build)" : ""}</span>
      </SettingRow>
      <SettingRow label="Database">
        {#snippet below()}
          <p class="input truncate py-1 text-xs text-zinc-400 select-all" title={databasePath}>{databasePath}</p>
        {/snippet}
      </SettingRow>
      <SettingRow label="Source code" description="github.com/Shehan17/milestone-space">
        <button type="button" class="btn btn-ghost border border-zinc-800" onclick={() => openUrl(GITHUB_URL)}>
          <Icon name="github" size={14} />Open on GitHub
        </button>
      </SettingRow>
    </SettingsSection>
  </div>
</div>
