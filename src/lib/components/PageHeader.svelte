<!--
  The top of every page: a large title with a line under it, and the page's main buttons on the right.
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";

  interface Props {
    title: string;
    subtitle?: string;
    /** A small line above the title. */
    eyebrow?: string;
    /** Instead of `subtitle`, for a line with links or badges (project page). */
    meta?: Snippet;
    /** Before the title, e.g. the project's avatar. */
    leading?: Snippet;
    /** A "‹ Projects" link above the title. */
    back?: { href: string; label: string };
    actions?: Snippet;
    /** Single-column pages (Inbox, Clients): the narrower page width. */
    narrow?: boolean;
    /** A smaller title and eyebrow (Today's greeting). */
    small?: boolean;
  }

  let { title, subtitle, eyebrow, meta, leading, back, actions, narrow = false, small = false }: Props = $props();
</script>

<header class="page {narrow ? 'page-narrow' : ''} {back ? 'pt-7' : 'pt-9'} pb-2">
  {#if back}
    <a href={back.href} class="mb-3.5 inline-flex items-center gap-1 text-ui text-muted transition-colors duration-150 hover:text-strong">
      <Icon name="back" size={16} />{back.label}
    </a>
  {/if}
  <div class="flex flex-wrap items-end justify-between gap-4">
    <div class="flex min-w-0 items-center gap-3.5">
      {#if leading}{@render leading()}{/if}
      <div class="min-w-0">
        {#if eyebrow}<p class="{small ? 'mb-0.5 text-2xs' : 'mb-1 text-ui'} text-faint">{eyebrow}</p>{/if}
        <h1 class="truncate {small ? 'text-lg' : 'text-title'} font-semibold text-strong">{title}</h1>
        {#if meta}
          {@render meta()}
        {:else if subtitle}
          <p class="mt-1.5 text-sm text-muted">{subtitle}</p>
        {/if}
      </div>
    </div>
    {#if actions}
      <div class="flex shrink-0 flex-wrap items-center gap-2">{@render actions()}</div>
    {/if}
  </div>
</header>
