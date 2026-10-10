<!-- Settings → Data and backup: backups (manual and automatic), restore, export, data folder. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import Icon from "$lib/components/Icon.svelte";
  import Modal from "$lib/components/Modal.svelte";
  import Tabs from "$lib/components/Tabs.svelte";
  import {
    appPaths,
    autoBackupStatus,
    backupNow,
    exportJson,
    exportProjectsCsv,
    exportTasksCsv,
    restoreBackup,
    type AppPaths,
  } from "$lib/backup.svelte";
  import { formatDateTime } from "$lib/dates";
  import { settings, type AutoBackup } from "$lib/settings.svelte";
  import { openFolder } from "$lib/system";
  import SettingRow from "./SettingRow.svelte";

  let paths = $state<AppPaths | null>(null);
  let folder = $derived(settings.backup_folder ?? paths?.default_backup_dir ?? "");

  onMount(async () => {
    paths = await appPaths();
  });

  /** Result of the last action, shown under the buttons. */
  let message = $state<{ text: string; error?: boolean; folder?: string } | null>(null);
  let busy = $state(false);

  async function run(action: () => Promise<void>) {
    busy = true;
    message = null;
    try {
      await action();
    } catch (e) {
      message = { text: String(e), error: true };
    } finally {
      busy = false;
    }
  }

  const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
  const parentFolder = (path: string) => path.slice(0, Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/")));

  const backup = () =>
    run(async () => {
      const path = await backupNow();
      autoBackupStatus.error = null;
      message = { text: `Backup saved: ${fileName(path)}`, folder: parentFolder(path) };
    });

  async function chooseFolder() {
    const picked = await open({ directory: true, defaultPath: folder || undefined, title: "Backup folder" });
    if (typeof picked === "string") settings.backup_folder = picked;
  }

  const exportWith = (action: () => Promise<string | null>) =>
    run(async () => {
      const path = await action();
      if (path) message = { text: `Exported to ${fileName(path)}`, folder: parentFolder(path) };
    });

  // ----- Restore -----
  let restorePath = $state<string | null>(null);

  async function pickRestore() {
    const picked = await open({
      title: "Restore from backup",
      defaultPath: folder || undefined,
      filters: [{ name: "MilestoneSpace backup", extensions: ["db"] }],
    });
    if (typeof picked === "string") restorePath = picked;
  }

  async function restore() {
    const path = restorePath;
    if (!path) return;
    try {
      await restoreBackup(path);
    } catch (e) {
      restorePath = null;
      message = { text: String(e), error: true };
      return;
    }
    // Every page reloads its data from the restored database.
    location.reload();
  }

  const backupOptions: { value: AutoBackup; label: string }[] = [
    { value: "off", label: "Off" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
  ];
  const KEEP_OPTIONS = [5, 10, 14, 30, 60];
</script>

<SettingRow
  label="Back up now"
  description={settings.last_backup_at
    ? `Last backup: ${formatDateTime(new Date(settings.last_backup_at))}`
    : "No backup made yet."}
>
  <button type="button" class="btn btn-primary" disabled={busy} onclick={backup}>Back up now</button>
</SettingRow>

<SettingRow label="Automatic backup" description="Made while MilestoneSpace is running (also from the tray).">
  <Tabs options={backupOptions} bind:value={settings.auto_backup} />
</SettingRow>

<SettingRow
  label="Backup folder"
  description="Pick a folder inside Google Drive or OneDrive to keep a copy off this laptop."
>
  {#snippet below()}
    <div class="flex items-center gap-2">
      <p class="input min-w-0 flex-1 truncate py-1 text-xs text-zinc-400" title={folder}>{folder}</p>
      <button type="button" class="btn btn-ghost shrink-0 border border-zinc-800 px-2.5 py-1 text-xs" onclick={chooseFolder}>
        Change…
      </button>
      {#if settings.backup_folder}
        <button type="button" class="btn btn-ghost shrink-0 px-2.5 py-1 text-xs" onclick={() => (settings.backup_folder = null)}>
          Use default
        </button>
      {/if}
      <button
        type="button"
        class="icon-btn shrink-0"
        title="Open the folder"
        aria-label="Open the backup folder"
        onclick={() => run(() => openFolder(folder))}
      >
        <Icon name="folder" size={14} />
      </button>
    </div>
    {#if autoBackupStatus.error}
      <p class="mt-2 text-xs text-red-400">The last automatic backup failed: {autoBackupStatus.error}</p>
    {/if}
  {/snippet}
  <select class="input w-36 py-1 text-xs" bind:value={settings.backup_keep} aria-label="Backups to keep">
    {#each KEEP_OPTIONS as n (n)}
      <option value={n}>Keep {n} backups</option>
    {/each}
  </select>
</SettingRow>

<SettingRow label="Restore from a backup" description="Replaces all current data. A copy of the current data is saved first.">
  <button type="button" class="btn btn-ghost border border-zinc-800" disabled={busy} onclick={pickRestore}>Choose backup…</button>
</SettingRow>

<SettingRow label="Export" description="Everything as JSON, or tasks / projects as CSV for Excel or Google Sheets.">
  <button type="button" class="btn btn-ghost border border-zinc-800 px-2.5 py-1 text-xs" disabled={busy} onclick={() => exportWith(exportJson)}>
    JSON
  </button>
  <button type="button" class="btn btn-ghost border border-zinc-800 px-2.5 py-1 text-xs" disabled={busy} onclick={() => exportWith(exportTasksCsv)}>
    Tasks CSV
  </button>
  <button type="button" class="btn btn-ghost border border-zinc-800 px-2.5 py-1 text-xs" disabled={busy} onclick={() => exportWith(exportProjectsCsv)}>
    Projects CSV
  </button>
</SettingRow>

<SettingRow label="Data folder" description="Where the database and settings are stored.">
  <button
    type="button"
    class="btn btn-ghost border border-zinc-800"
    disabled={!paths}
    onclick={() => paths && run(() => openFolder(paths!.data_dir))}
  >
    <Icon name="folder" size={14} />Open data folder
  </button>
</SettingRow>

{#if message}
  {@const result = message}
  <div class="flex items-center gap-3 px-4 py-2.5 text-xs {result.error ? 'text-red-400' : 'text-emerald-300'}">
    <p class="min-w-0 flex-1 break-words">{result.text}</p>
    {#if result.folder}
      <button type="button" class="btn btn-ghost px-2 py-0.5 text-xs" onclick={() => openFolder(result.folder!)}>Show in folder</button>
    {/if}
  </div>
{/if}

<Modal open={restorePath !== null} title="Restore from backup?" submitLabel="Restore" danger onclose={() => (restorePath = null)} onsubmit={restore}>
  <p class="text-sm text-zinc-300">
    All current clients, projects, tasks and notes will be replaced with the data in
    <span class="font-medium text-zinc-100">{restorePath ? fileName(restorePath) : ""}</span>.
  </p>
  <p class="text-xs text-zinc-500">
    A copy of the current data is saved in the data folder first ("…backup-before-restore-…"), so it can be brought
    back. The app reloads when it's done.
  </p>
</Modal>
