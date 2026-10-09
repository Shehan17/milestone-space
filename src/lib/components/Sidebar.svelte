<script lang="ts">
  import { page } from "$app/state";
  import Icon, { type IconName } from "./Icon.svelte";

  type Link = { href: string; label: string; icon: IconName };

  const mainLinks: Link[] = [
    { href: "/", label: "Dashboard", icon: "dashboard" },
    { href: "/projects", label: "Projects", icon: "projects" },
    { href: "/tasks", label: "Tasks", icon: "tasks" },
  ];

  const secondaryLinks: Link[] = [{ href: "/clients", label: "Clients", icon: "clients" }];

  const settingsLink: Link = { href: "/settings", label: "Settings", icon: "settings" };

  function isActive(href: string) {
    const path = page.url.pathname;
    return href === "/" ? path === "/" : path.startsWith(href);
  }
</script>

{#snippet navLink(link: Link)}
  <a
    href={link.href}
    class="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors {isActive(link.href)
      ? 'bg-zinc-800 text-zinc-100'
      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}"
  >
    <span class={isActive(link.href) ? "text-violet-400" : ""}><Icon name={link.icon} /></span>
    {link.label}
  </a>
{/snippet}

<aside class="flex w-52 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-900/40 px-2 py-3">
  <div class="mb-4 flex items-center gap-2 px-2.5 py-1">
    <img src="/logo.png" alt="" class="size-6 shrink-0" />
    <span class="text-sm font-semibold text-zinc-100">MilestoneSpace</span>
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

  <nav class="mt-auto">
    {@render navLink(settingsLink)}
  </nav>
</aside>
