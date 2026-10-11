<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import ShortcutsHelp from "$lib/components/ShortcutsHelp.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import Toaster from "$lib/components/Toaster.svelte";
  import { runAutoBackup } from "$lib/backup.svelte";
  import { initDb } from "$lib/db";
  import { onInboxChanged, refreshInboxCount } from "$lib/inbox.svelte";
  import { checkNotifications } from "$lib/notifications";
  import { handleGlobalKey } from "$lib/shortcuts.svelte";
  import { toast } from "$lib/toast.svelte";

  let { children } = $props();

  // The quick capture window (/quick) is just the page: no sidebar, shortcuts or error messages.
  const bare = page.url.pathname.startsWith("/quick");

  onMount(() => {
    // Any failed database call that isn't caught on a page ends up here, as an error message.
    const showError = (event: PromiseRejectionEvent) => {
      toast.error("Something went wrong. Your last change may not have been saved.", event.reason);
    };
    window.addEventListener("unhandledrejection", showError);
    initDb()
      .then(() => (bare ? undefined : refreshInboxCount()))
      .catch((e) => toast.error("Couldn't open the database", e));
    // Keep the sidebar's Inbox count right when the quick capture window saves something.
    const stopListening = bare ? () => {} : onInboxChanged(refreshInboxCount);

    // Reminders and automatic backups run in the main window, which stays alive in the tray.
    // A failed check is logged rather than shown, and tried again on the next round.
    const timers: ReturnType<typeof setInterval>[] = [];
    if (!bare) {
      const notifications = () => checkNotifications().catch((e) => console.error("Notifications:", e));
      const backup = () => runAutoBackup().catch((e) => console.error("Auto backup:", e));
      timers.push(setTimeout(notifications, 5_000), setInterval(notifications, 60_000));
      timers.push(setTimeout(backup, 30_000), setInterval(backup, 15 * 60_000));
    }

    return () => {
      window.removeEventListener("unhandledrejection", showError);
      stopListening();
      timers.forEach(clearInterval);
    };
  });
</script>

<svelte:window onkeydown={bare ? undefined : handleGlobalKey} />

{#if bare}
  {@render children()}
{:else}
  <div class="flex h-screen overflow-hidden">
    <Sidebar />
    <main class="min-w-0 flex-1 overflow-y-auto">
      {@render children()}
    </main>
  </div>

  <ShortcutsHelp />
  <Toaster />
{/if}
