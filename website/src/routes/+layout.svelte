<script lang="ts">
  import "@fontsource-variable/onest";
  import "../app.css";
  import type { Snippet } from "svelte";
  import { appIcon } from "$lib/assets";
  import Footer from "$lib/components/Footer.svelte";
  import Header from "$lib/components/Header.svelte";

  let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
  <link rel="icon" type="image/png" href={appIcon} />
</svelte:head>

<div class="flex min-h-screen flex-col">
  <Header />
  <main class="flex-1">
    {@render children()}
  </main>
  <Footer />
</div>
