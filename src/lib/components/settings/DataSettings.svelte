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
  import { toast } from "$lib/toast.svelte";
  import SettingRow from "./SettingRow.svelte";
  import SettingsCard from "./SettingsCard.svelte";

  let paths = $state<AppPaths | null>(null);
  let folder = $derived(settings.backup_folder ?? paths?.default_backup_dir ?? "");

  onMount(async () => {
    paths = await appPaths();
  });

  let busy = $state(false);

  /** Runs one action at a time; a failure becomes an error message. */
  async function run(failure: string, action: () => Promise<void>) {
    busy = true;
    try {
      await action();
    } catch (e) {
      toast.error(failure, e);
    } finally {
      busy = false;
    }
  }

  const fileName = (path: string) => path.split(/[\\/]/).pop() ?? path;
  const parentFolder = (path: string) => path.slice(0, Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/")));

  /** "Saved as …" with a button that shows the file in Explorer. */
  function savedToast(message: string, path: string) {
    const dir = parentFolder(path);
    toast.success(message, { detail: fileName(path), action: { label: "Show", run: () => openFolder(dir) } });
  }

  const backup = () =>
    run("The backup didn't work", async () => {
      const path = await backupNow();
      autoBackupStatus.error = null;
      savedToast("Backup saved", path);
    });

  async function chooseFolder() {
    const picked = await open({ directory: true, defaultPath: folder || undefined, title: "Backup folder" });
    if (typeof picked === "string") settings.backup_folder = picked;
  }

  const exportWith = (action: () => Promise<string | null>) =>
    run("The export didn't work", async () => {
      const path = await action();
      if (path) savedToast("Exported", path);
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
      toast.error("The restore didn't work. Your data wasn't changed.", e);
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

<SettingsCard title="Backups">
  <SettingRow
    label="Back up now"
    description={settings.last_backup_at
      ? `Last backup: ${formatDateTime(new Date(settings.last_backup_at))}`
      : "No backup made yet."}
  >
    <button type="button" class="btn btn-primary" disabled={busy} onclick={backup}>Back up now</button>
  </SettingRow>

  <SettingRow label="Automatic backup" description="Made while MilestoneSpace is running (also from the tray).">
    <Tabs options={backupOptions} bind:value={settings.auto_backup} label="Automatic backup" />
  </SettingRow>

  <SettingRow
    label="Backup folder"
    description="Pick a folder inside Google Drive or OneDrive to keep a copy off this laptop."
  >
    {#snippet below()}
      <div class="flex items-center gap-2">
        <p class="input input-sm min-w-0 flex-1 truncate text-muted" title={folder}>{folder}</p>
        <button type="button" class="btn btn-secondary btn-sm shrink-0" onclick={chooseFolder}>Change…</button>
        {#if settings.backup_folder}
          <button type="button" class="btn btn-ghost btn-sm shrink-0" onclick={() => (settings.backup_folder = null)}>
            Use default
          </button>
        {/if}
        <button
          type="button"
          class="icon-btn"
          title="Open the folder"
          aria-label="Open the backup folder"
          onclick={() => run("Couldn't open the folder", () => openFolder(folder))}
        >
          <Icon name="folder" size={14} />
        </button>
      </div>
      {#if autoBackupStatus.error}
        <p class="field-error" role="alert"><Icon name="alert" size={12} />The last automatic backup failed: {autoBackupStatus.error}</p>
      {/if}
    {/snippet}
    <select class="input input-sm w-36" bind:value={settings.backup_keep} aria-label="Backups to keep">
      {#each KEEP_OPTIONS as n (n)}
        <option value={n}>Keep {n} backups</option>
      {/each}
    </select>
  </SettingRow>

  <SettingRow label="Restore from a backup" description="Replaces all current data. A copy of the current data is saved first.">
    <button type="button" class="btn btn-secondary" disabled={busy} onclick={pickRestore}>Choose backup…</button>
  </SettingRow>
</SettingsCard>

<SettingsCard title="Export and files">

  <SettingRow label="Export" description="Everything as JSON, or tasks / projects as CSV for Excel or Google Sheets.">
    <button type="button" class="btn btn-secondary btn-sm" disabled={busy} onclick={() => exportWith(exportJson)}>JSON</button>
    <button type="button" class="btn btn-secondary btn-sm" disabled={busy} onclick={() => exportWith(exportTasksCsv)}>Tasks CSV</button>
    <button type="button" class="btn btn-secondary btn-sm" disabled={busy} onclick={() => exportWith(exportProjectsCsv)}>
      Projects CSV
    </button>
  </SettingRow>

  <SettingRow label="Data folder" description="Where the database and settings are stored.">
    <button
      type="button"
      class="btn btn-secondary"
      disabled={!paths}
      onclick={() => paths && run("Couldn't open the folder", () => openFolder(paths!.data_dir))}
    >
      <Icon name="folder" size={14} />Open data folder
    </button>
  </SettingRow>
</SettingsCard>

<Modal
  open={restorePath !== null}
  title="Restore from backup?"
  submitLabel="Restore"
  danger
  onclose={() => (restorePath = null)}
  onsubmit={restore}
>
  <p class="text-sm text-fg">
    All current clients, projects, tasks and notes will be replaced with the data in
    <span class="font-medium text-strong">{restorePath ? fileName(restorePath) : ""}</span>.
  </p>
  <p class="text-xs text-faint">
    A copy of the current data is saved in the data folder first ("…backup-before-restore-…"), so it can be brought
    back. The app reloads when it's done.
  </p>
</Modal>
