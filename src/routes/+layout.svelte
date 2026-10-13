<script lang="ts">
  import "@fontsource-variable/onest";
  import "../app.css";
  import { onMount } from "svelte";
  import { listen } from "@tauri-apps/api/event";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import QuickAdd from "$lib/components/QuickAdd.svelte";
  import ShortcutsHelp from "$lib/components/ShortcutsHelp.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import TitleBar from "$lib/components/TitleBar.svelte";
  import Toaster from "$lib/components/Toaster.svelte";
  import { runAutoBackup } from "$lib/backup.svelte";
  import { initDb } from "$lib/db";
  import { onInboxChanged, refreshInboxCount } from "$lib/inbox.svelte";
  import { checkNotifications } from "$lib/notifications";
  import { settings } from "$lib/settings.svelte";
  import { handleGlobalKey } from "$lib/shortcuts.svelte";
  import { applyAppearance, followThemeChanges } from "$lib/theme";
  import { toast } from "$lib/toast.svelte";

  let { children } = $props();

  // The quick capture window (/quick) and the Today widget (/widget) are just the page: no sidebar,
  // shortcuts or error messages.
  const bare = page.url.pathname.startsWith("/quick") || page.url.pathname.startsWith("/widget");

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
    // A theme picked in another window. The accent's shades depend on light / dark, so apply it again.
    const stopTheme = followThemeChanges(() => applyAppearance(settings));
    // The widget opens a page here (open_main in src-tauri/src/lib.rs).
    const stopNavigate = bare ? undefined : listen<string>("navigate", ({ payload }) => goto(payload));

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
      stopTheme();
      stopNavigate?.then((stop) => stop());
      timers.forEach(clearInterval);
    };
  });
</script>

<svelte:window onkeydown={bare ? undefined : handleGlobalKey} />

{#if bare}
  {@render children()}
{:else}
  <!-- Title bar on top, then the sidebar and the page as two panels on the window's chrome. -->
  <div class="flex h-screen flex-col overflow-hidden bg-chrome">
    <TitleBar />
    <div class="flex min-h-0 flex-1 gap-2.5 px-2.5 pb-2.5">
      <Sidebar />
      <main class="min-w-0 flex-1 overflow-y-auto rounded-card border border-line bg-canvas">
        {@render children()}
      </main>
    </div>
  </div>

  <QuickAdd />
  <ShortcutsHelp />
  <Toaster />
{/if}
