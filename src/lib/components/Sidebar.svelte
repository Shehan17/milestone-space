<script lang="ts">
  import { page } from "$app/state";
  import { inbox } from "$lib/inbox.svelte";
  import { helpState } from "$lib/shortcuts.svelte";
  import { isSidebarCollapsed, sidebar, toggleSidebar } from "$lib/sidebar.svelte";
  import Icon, { type IconName } from "./Icon.svelte";

  /** key: the letter after G that opens the page (see shortcuts.svelte.ts). */
  type Link = { href: string; label: string; icon: IconName; key: string; badge?: number };

  let mainLinks: Link[] = $derived([
    { href: "/", label: "Today", icon: "sun", key: "T" },
    { href: "/inbox", label: "Inbox", icon: "inbox", key: "I", badge: inbox.count },
    { href: "/dashboard", label: "Dashboard", icon: "dashboard", key: "D" },
    { href: "/projects", label: "Projects", icon: "projects", key: "P" },
    { href: "/tasks", label: "Tasks", icon: "tasks", key: "A" },
  ]);

  const secondaryLinks: Link[] = [{ href: "/clients", label: "Clients", icon: "clients", key: "C" }];

  const settingsLink: Link = { href: "/settings", label: "Settings", icon: "settings", key: "S" };

  let collapsed = $derived(isSidebarCollapsed());

  function isActive(href: string) {
    const path = page.url.pathname;
    return href === "/" ? path === "/" : path.startsWith(href);
  }

  const itemClass = "flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-control text-sm transition-colors duration-150";
</script>

{#snippet navLink(link: Link)}
  {@const active = isActive(link.href)}
  <a
    href={link.href}
    title={collapsed ? `${link.label} (G then ${link.key})` : `G then ${link.key}`}
    aria-current={active ? "page" : undefined}
    class="{itemClass} {collapsed ? 'justify-center' : 'px-2.5'} {active
      ? 'bg-selected font-medium text-strong'
      : 'text-muted hover:bg-hover hover:text-strong'}"
  >
    <span class="relative {active ? 'text-accent-text' : ''}">
      <Icon name={link.icon} />
      {#if collapsed && link.badge}
        <span class="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-accent px-1 text-center text-2xs leading-4 font-semibold text-white tabular-nums">
          {link.badge}
        </span>
      {/if}
    </span>
    <span class={collapsed ? "sr-only" : "truncate"}>{link.label}</span>
    {#if !collapsed && link.badge}
      <span class="ml-auto rounded-full bg-accent/15 px-1.5 text-2xs font-semibold text-accent-text-strong tabular-nums">
        {link.badge}
      </span>
    {/if}
  </a>
{/snippet}

<aside
  class="flex shrink-0 flex-col border-r border-line bg-sidebar px-2 py-3 transition-[width] duration-150 {collapsed ? 'w-14' : 'w-52'}"
  aria-label="Main navigation"
>
  <div class="mb-4 flex h-8 items-center gap-2 {collapsed ? 'justify-center' : 'px-2'}">
    <span class="relative shrink-0">
      <img src="/logo.png" alt="MilestoneSpace" class="size-6" />
      {#if import.meta.env.DEV && collapsed}
        <span class="absolute -right-1 -bottom-1 size-2 rounded-full bg-accent ring-2 ring-sidebar" title="Development build"></span>
      {/if}
    </span>
    {#if !collapsed}
      <span class="truncate text-sm font-semibold text-strong">MilestoneSpace</span>
      {#if import.meta.env.DEV}
        <span class="badge bg-accent/15 px-1 py-0 text-2xs text-accent-text-strong" title="Development build: using tracker-dev.db">DEV</span>
      {/if}
    {/if}
  </div>

  <nav class="space-y-0.5">
    {#each mainLinks as link (link.href)}
      {@render navLink(link)}
    {/each}
  </nav>

  {#if collapsed}
    <div class="mx-2 my-3 border-t border-line"></div>
  {:else}
    <p class="eyebrow mt-6 mb-1 px-2.5">More</p>
  {/if}
  <nav class="space-y-0.5">
    {#each secondaryLinks as link (link.href)}
      {@render navLink(link)}
    {/each}
  </nav>

  <div class="mt-auto space-y-0.5">
    {#if !sidebar.narrow}
      <button
        type="button"
        class="{itemClass} text-faint hover:bg-hover hover:text-strong {collapsed ? 'justify-center' : 'px-2.5'}"
        title={collapsed ? "Expand sidebar ([)" : "Collapse sidebar ([)"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        onclick={toggleSidebar}
      >
        <Icon name="panel" />
        {#if !collapsed}<span>Collapse</span><kbd class="kbd ml-auto">[</kbd>{/if}
      </button>
    {/if}
    <button
      type="button"
      class="{itemClass} text-faint hover:bg-hover hover:text-strong {collapsed ? 'justify-center' : 'px-2.5'}"
      title="Keyboard shortcuts (?)"
      onclick={() => (helpState.open = true)}
    >
      <Icon name="keyboard" />
      <span class={collapsed ? "sr-only" : ""}>Shortcuts</span>
      {#if !collapsed}<kbd class="kbd ml-auto">?</kbd>{/if}
    </button>
    {@render navLink(settingsLink)}
  </div>
</aside>
