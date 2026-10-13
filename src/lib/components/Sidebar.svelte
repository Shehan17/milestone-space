<script lang="ts">
  import { page } from "$app/state";
  import { inbox } from "$lib/inbox.svelte";
  import { openQuickAdd } from "$lib/quickadd.svelte";
  import { quickCaptureKeys } from "$lib/settings.svelte";
  import { helpState } from "$lib/shortcuts.svelte";
  import { isSidebarCollapsed, sidebar, toggleSidebar } from "$lib/sidebar.svelte";
  import Icon, { type IconName } from "./Icon.svelte";

  /** key: the letter after G that opens the page (see shortcuts.svelte.ts). */
  type Link = { href: string; label: string; icon: IconName; key: string; badge?: number };

  let mainLinks: Link[] = $derived([
    { href: "/", label: "Today", icon: "sun", key: "T" },
    { href: "/inbox", label: "Inbox", icon: "inbox", key: "I", badge: inbox.count },
    { href: "/projects", label: "Projects", icon: "projects", key: "P" },
    { href: "/tasks", label: "All tasks", icon: "tasks", key: "A" },
    { href: "/misc", label: "Misc", icon: "shapes", key: "M" },
  ]);

  const moreLinks: Link[] = [
    { href: "/clients", label: "Clients", icon: "clients", key: "C" },
    { href: "/settings", label: "Settings", icon: "settings", key: "S" },
  ];

  let collapsed = $derived(isSidebarCollapsed());

  function isActive(href: string) {
    const path = page.url.pathname;
    return href === "/" ? path === "/" : path.startsWith(href);
  }

  const itemClass = "flex w-full cursor-pointer items-center rounded-control transition-colors duration-150";
</script>

{#snippet navLink(link: Link)}
  {@const active = isActive(link.href)}
  <a
    href={link.href}
    title={collapsed ? `${link.label} (G then ${link.key})` : `G then ${link.key}`}
    aria-current={active ? "page" : undefined}
    class="{itemClass} h-10 gap-3 text-sm {collapsed ? 'justify-center' : 'px-3'} {active
      ? 'bg-selected font-semibold text-strong'
      : 'text-muted hover:bg-selected hover:text-strong'}"
  >
    <span class="relative {active ? 'text-accent-text' : ''}">
      <Icon name={link.icon} size={18} />
      {#if collapsed && link.badge}
        <span class="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-accent px-1 text-center text-2xs leading-4 font-semibold text-on-accent tabular-nums">
          {link.badge}
        </span>
      {/if}
    </span>
    <span class={collapsed ? "sr-only" : "truncate"}>{link.label}</span>
    {#if !collapsed && link.badge}
      <span class="ml-auto min-w-5.5 rounded-full bg-accent/14 px-1.75 text-center text-2xs leading-5 font-semibold text-accent-text-strong tabular-nums">
        {link.badge}
      </span>
    {/if}
  </a>
{/snippet}

<aside
  class="flex shrink-0 flex-col gap-1 rounded-card border border-line bg-sidebar py-4 transition-[width] duration-150 {collapsed
    ? 'w-16 px-2.5'
    : 'w-58 px-3'}"
  aria-label="Main navigation"
>
  <button
    type="button"
    class="{itemClass} mb-4 h-10 gap-2.5 bg-accent text-sm font-semibold text-on-accent hover:bg-accent-hover {collapsed
      ? 'justify-center'
      : 'px-3'}"
    title="New task, idea or project"
    onclick={() => openQuickAdd()}
  >
    <Icon name="plus" size={18} />
    {#if collapsed}
      <span class="sr-only">New</span>
    {:else}
      <span class="flex-1 text-left">New</span>
    {/if}
  </button>

  <nav class="space-y-1">
    {#each mainLinks as link (link.href)}
      {@render navLink(link)}
    {/each}
  </nav>

  {#if collapsed}
    <div class="mx-2 my-3 border-t border-line"></div>
  {:else}
    <p class="eyebrow mt-5 mb-1 px-3">More</p>
  {/if}
  <nav class="space-y-1">
    {#each moreLinks as link (link.href)}
      {@render navLink(link)}
    {/each}
  </nav>

  <div class="mt-auto space-y-2">
    {#if !collapsed}
      <div class="space-y-1.5 rounded-item border border-line bg-surface p-3.5">
        <p class="text-xs font-semibold text-strong">Capture from anywhere</p>
        <p class="text-xs text-muted">
          Press <kbd class="kbd">{quickCaptureKeys()}</kbd> to drop an idea into your Inbox.
        </p>
      </div>
    {/if}
    <div class="flex gap-1 {collapsed ? 'flex-col items-center' : ''}">
      <button
        type="button"
        class="{itemClass} h-8 gap-2 text-xs text-faint hover:bg-selected hover:text-strong {collapsed ? 'justify-center' : 'flex-1 px-3'}"
        title="Keyboard shortcuts (?)"
        onclick={() => (helpState.open = true)}
      >
        <Icon name="keyboard" size={16} />
        <span class={collapsed ? "sr-only" : ""}>Shortcuts</span>
        {#if !collapsed}<kbd class="kbd ml-auto">?</kbd>{/if}
      </button>
      {#if !sidebar.narrow}
        <button
          type="button"
          class="{itemClass} size-8 shrink-0 justify-center text-faint hover:bg-selected hover:text-strong"
          title={collapsed ? "Expand sidebar ([)" : "Collapse sidebar ([)"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onclick={toggleSidebar}
        >
          <Icon name="panel" size={16} />
        </button>
      {/if}
    </div>
  </div>
</aside>
