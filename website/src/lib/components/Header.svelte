<script lang="ts">
  import { resolve } from "$app/paths";
  import { appIcon } from "$lib/assets";
  import { nav, site } from "$lib/site";
  import Icon from "./Icon.svelte";

  // Section links ("#features") point at the home page, so they also work from other pages.
  const href = (link: string) => (link.startsWith("#") ? `${resolve("/")}${link}` : link);
</script>

<header class="sticky top-0 z-10 border-b border-line bg-chrome/85 backdrop-blur">
  <div class="container-page flex h-16 items-center gap-6">
    <a href={resolve("/")} class="flex items-center gap-2.5 font-semibold text-strong">
      <img src={appIcon} alt="" width="32" height="32" />
      {site.name}
    </a>

    <nav aria-label="Main" class="ml-auto hidden items-center gap-1 sm:flex">
      {#each nav as item (item.href)}
        <a
          href={href(item.href)}
          class="rounded-control px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-hover hover:text-strong"
        >
          {item.label}
        </a>
      {/each}
    </nav>

    <a href={site.repo} class="btn btn-secondary ml-auto px-3 sm:ml-0" aria-label="{site.name} on GitHub">
      <Icon name="github" size={18} />
      <span class="hidden md:inline">GitHub</span>
    </a>
  </div>
</header>
