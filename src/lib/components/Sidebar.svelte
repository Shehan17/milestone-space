<script lang="ts">
  import { page } from "$app/state";
  import { inbox } from "$lib/inbox.svelte";
  import { helpState } from "$lib/shortcuts.svelte";
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

  function isActive(href: string) {
    const path = page.url.pathname;
    return href === "/" ? path === "/" : path.startsWith(href);
  }
</script>

{#snippet navLink(link: Link)}
  <a
    href={link.href}
    title="{link.label} · G then {link.key}"
    class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors {isActive(link.href)
      ? 'bg-zinc-800 text-zinc-100'
      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}"
  >
    <span class={isActive(link.href) ? "text-violet-400" : ""}><Icon name={link.icon} /></span>
    {link.label}
    {#if link.badge}
      <span class="ml-auto rounded-full bg-violet-500/15 px-1.5 text-[11px] font-medium text-violet-300 tabular-nums">
        {link.badge}
      </span>
    {/if}
  </a>
{/snippet}

<aside class="flex w-52 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-900/40 px-2 py-3">
  <div class="mb-4 flex items-center gap-2 px-2.5 py-1">
    <img src="/logo.png" alt="" class="size-6 shrink-0" />
    <span class="text-sm font-semibold text-zinc-100">MilestoneSpace</span>
    {#if import.meta.env.DEV}
      <span
        class="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300"
        title="Development build: using tracker-dev.db">DEV</span
      >
    {/if}
  </div>

  <nav class="space-y-0.5">
    {#each mainLinks as link (link.href)}
      {@render navLink(link)}
    {/each}
  </nav>

  <p class="mt-6 mb-1 px-2.5 text-[11px] font-medium tracking-wide text-zinc-600 uppercase">More</p>
  <nav class="space-y-0.5">
    {#each secondaryLinks as link (link.href)}
      {@render navLink(link)}
    {/each}
  </nav>

  <nav class="mt-auto space-y-0.5">
    <button
      type="button"
      class="flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-800/50 hover:text-zinc-200"
      onclick={() => (helpState.open = true)}
    >
      Shortcuts
      <kbd class="ml-auto rounded border border-zinc-700 bg-zinc-800 px-1.5 font-sans text-[11px] text-zinc-400">?</kbd>
    </button>
    {@render navLink(settingsLink)}
  </nav>
</aside>
