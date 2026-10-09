<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import { initDb } from "$lib/db";

  let { children } = $props();

  let error = $state("");

  onMount(() => {
    // Any failed database call that isn't caught on a page ends up here.
    const showError = (event: PromiseRejectionEvent) => {
      error = String(event.reason);
    };
    window.addEventListener("unhandledrejection", showError);
    initDb().catch((e) => (error = String(e)));
    return () => window.removeEventListener("unhandledrejection", showError);
  });
</script>

<div class="flex h-screen overflow-hidden">
  <Sidebar />
  <main class="min-w-0 flex-1 overflow-y-auto">
    {@render children()}
  </main>
</div>

{#if error}
  <div
    class="fixed right-4 bottom-4 z-50 flex max-w-md items-start gap-3 rounded-lg border border-red-500/30 bg-red-950/90 px-4 py-3 text-sm text-red-200 shadow-lg"
  >
    <p class="flex-1 break-words">{error}</p>
    <button type="button" class="icon-btn text-red-300" onclick={() => (error = "")}>Dismiss</button>
  </div>
{/if}
